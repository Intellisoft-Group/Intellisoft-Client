import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthUser } from '../common/current-user.decorator';
import { publicFileUrl } from '../common/utils';

@Injectable()
export class OrganizationsService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  async list(user: AuthUser, q?: string) {
    const where: Prisma.OrganizationWhereInput = {};
    if (user.role === 'CLIENT') {
      where.id = user.organizationId || '__none__';
    } else if (user.role === 'SALES') {
      where.salesPersonId = user.id;
    }
    if (q) {
      where.OR = [
        { name: { contains: q } },
        { gstin: { contains: q } },
        { email: { contains: q } },
        { phone: { contains: q } },
        {
          users: {
            some: {
              OR: [
                { name: { contains: q } },
                { email: { contains: q } },
                { phone: { contains: q } },
              ],
            },
          },
        },
      ];
    }
    const api = process.env.API_PUBLIC_URL || 'http://localhost:3000';
    const rows = await this.prisma.organization.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { users: true, invoices: true, subscriptions: true } },
        salesPerson: { select: { id: true, name: true, email: true } },
        users: {
          where: { role: Role.CLIENT },
          take: 4,
          select: { id: true, name: true, email: true, phone: true, avatarPath: true },
        },
      },
    });
    return rows.map((row) => ({
      ...row,
      users: row.users.map((u) => ({ ...u, avatarUrl: publicFileUrl(api, u.avatarPath) })),
    }));
  }

  async get(id: string, user: AuthUser) {
    await this.assertOrg(id, user);
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        salesPerson: { select: { id: true, name: true, email: true, jobTitle: true } },
        users: { select: { id: true, name: true, email: true, phone: true, role: true, jobTitle: true, avatarPath: true, isActive: true } },
        subscriptions: { include: { catalog: true, soldBy: { select: { id: true, name: true } } } },
        invoices: {
          orderBy: { issueDate: 'desc' },
          take: 20,
          select: { id: true, number: true, status: true, total: true, amountDue: true, currency: true, dueDate: true, issueDate: true },
        },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    const api = process.env.API_PUBLIC_URL || 'http://localhost:3000';
    return {
      ...org,
      users: org.users.map((u) => ({ ...u, avatarUrl: publicFileUrl(api, u.avatarPath) })),
      invoices: org.invoices.map((i) => ({
        ...i,
        total: Number(i.total),
        amountDue: Number(i.amountDue),
      })),
    };
  }

  async create(data: Prisma.OrganizationCreateInput, user?: AuthUser) {
    const payload = { ...data } as Prisma.OrganizationCreateInput;
    if (user?.role === 'SALES' && !payload.salesPerson) {
      payload.salesPerson = { connect: { id: user.id } };
    }
    const org = await this.prisma.organization.create({ data: payload });
    await this.prisma.chatThread.create({
      data: { kind: 'ORGANIZATION', organizationId: org.id },
    });
    return org;
  }

  update(id: string, data: Prisma.OrganizationUpdateInput) {
    return this.prisma.organization.update({ where: { id }, data });
  }

  async ensureClient(body: { name: string; email: string; phone?: string }, user?: AuthUser) {
    const name = (body.name || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const phone = (body.phone || '').trim() || undefined;
    if (!name) throw new BadRequestException('Client name is required');
    if (!email) throw new BadRequestException('Client email is required');
    if (!phone) throw new BadRequestException('Client phone is required');

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser && existingUser.role !== Role.CLIENT) {
      throw new BadRequestException('That email belongs to a staff account');
    }

    if (existingUser?.organizationId) {
      const organization = await this.prisma.organization.findUnique({ where: { id: existingUser.organizationId } });
      if (phone && !existingUser.phone) {
        await this.prisma.user.update({ where: { id: existingUser.id }, data: { phone } });
      }
      return { organization, created: false, user: { id: existingUser.id, email: existingUser.email, name: existingUser.name } };
    }

    let organization = await this.prisma.organization.findFirst({
      where: { OR: [{ email }, { name }] },
    });
    if (!organization) {
      organization = await this.create({
        name,
        legalName: name,
        email,
        phone,
      } as any, user);
    } else if (user?.role === 'SALES' && !organization.salesPersonId) {
      organization = await this.prisma.organization.update({
        where: { id: organization.id },
        data: { salesPersonId: user.id },
      });
    } else if (phone && !organization.phone) {
      organization = await this.prisma.organization.update({
        where: { id: organization.id },
        data: { phone, email: organization.email || email },
      });
    }

    if (existingUser && !existingUser.organizationId) {
      await this.prisma.user.update({
        where: { id: existingUser.id },
        data: { organizationId: organization.id, name, phone: phone || existingUser.phone },
      });
      return { organization, created: false, user: { id: existingUser.id, email: existingUser.email, name } };
    }

    const invited = await this.inviteUser(organization.id, { email, name, phone });
    return {
      organization,
      created: true,
      user: { id: invited.id, email: invited.email, name },
      temporaryPassword: invited.temporaryPassword,
    };
  }

  async inviteUser(
    organizationId: string,
    body: { email: string; name: string; phone?: string; password?: string },
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) throw new BadRequestException('Email already in use');
    if (body.password && String(body.password).trim().length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const temp = body.password?.trim() || this.passwordFromPhone(body.phone);
    const passwordHash = await bcrypt.hash(temp, 10);
    const user = await this.prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        phone: body.phone,
        role: Role.CLIENT,
        organizationId,
        passwordHash,
        mustChangePassword: !body.password,
      },
    });
    await this.mail.send(
      user.email,
      'Your Intellisoft client portal access',
      this.mail.wrap(
        'Welcome to Intellisoft',
        `<p>Hi ${user.name}, your client portal is ready.</p><p>Email: <strong>${user.email}</strong></p>${
          body.password ? '' : `<p>Temporary password: <strong>${temp}</strong></p>`
        }<p>Sign in on the client portal or mobile app${body.password ? '' : ' and change the password after first login'}.</p>`,
      ),
    );
    return { id: user.id, email: user.email, temporaryPassword: body.password ? undefined : temp };
  }

  /** Staff rename / correct spelling for a CLIENT user on this organization. */
  async updateClientUser(
    organizationId: string,
    userId: string,
    body: { name?: string; phone?: string | null },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, role: Role.CLIENT },
    });
    if (!user) throw new NotFoundException('Client user not found');

    const data: Prisma.UserUpdateInput = {};
    if (body.name !== undefined) {
      const name = String(body.name || '').trim();
      if (!name) throw new BadRequestException('Name is required');
      data.name = name;
    }
    if (body.phone !== undefined) {
      data.phone = String(body.phone || '').trim() || null;
    }
    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data,
      select: { id: true, email: true, name: true, phone: true, avatarPath: true },
    });
    const api = process.env.API_PUBLIC_URL || 'http://localhost:3000';
    return { ...updated, avatarUrl: publicFileUrl(api, updated.avatarPath) };
  }

  /**
   * Staff set or reset a CLIENT user's password for this organization.
   * Omit password to auto-generate a temporary one (returned once in the response).
   */
  async setClientPassword(
    organizationId: string,
    userId: string,
    body: { password?: string; notify?: boolean },
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, role: Role.CLIENT },
    });
    if (!user) throw new NotFoundException('Client user not found');

    const provided = String(body.password || '').trim();
    if (provided && provided.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const password = provided || this.passwordFromPhone(user.phone);
    const passwordHash = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        mustChangePassword: !provided,
        refreshTokenHash: null,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    if (body.notify !== false) {
      await this.mail.send(
        user.email,
        'Your Intellisoft password was updated',
        this.mail.wrap(
          'Password updated',
          `<p>Hi ${user.name},</p><p>An Intellisoft team member set a new password for your account (${user.email}).</p>${
            provided
              ? '<p>Use the password they shared with you to sign in on the client portal or mobile app.</p>'
              : `<p>Temporary password: <strong>${password}</strong></p><p>Change it after you sign in.</p>`
          }`,
        ),
      );
    }

    return {
      ok: true,
      id: user.id,
      email: user.email,
      temporaryPassword: provided ? undefined : password,
      passwordSetByStaff: !!provided,
    };
  }

  /** Auto password: InSo + last 6 digits of the client's phone. */
  private passwordFromPhone(phone?: string | null) {
    const digits = String(phone || '').replace(/\D/g, '');
    if (digits.length < 6) {
      throw new BadRequestException(
        'Phone number with at least 6 digits is required to auto-generate the password (format InSo + last 6 digits).',
      );
    }
    return `InSo${digits.slice(-6)}`;
  }

  private async assertOrg(id: string, user: AuthUser) {
    if (user.role === 'CLIENT' && user.organizationId !== id) {
      throw new NotFoundException('Organization not found');
    }
    if (user.role === 'SALES') {
      const org = await this.prisma.organization.findFirst({
        where: { id, salesPersonId: user.id },
        select: { id: true },
      });
      if (!org) throw new NotFoundException('Organization not found');
    }
  }
}
