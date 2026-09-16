import { Injectable, BadRequestException, ForbiddenException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthUser } from '../common/current-user.decorator';
import { publicFileUrl } from '../common/utils';

const DEFAULT_TITLES = [
  'Director',
  'Team Lead',
  'Project Manager',
  'Developer',
  'Support Engineer',
  'Account Manager',
  'Consultant',
  'Finance Executive',
  'Sales Executive',
];

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mail: MailService,
  ) {}

  async onModuleInit() {
    for (const [i, name] of DEFAULT_TITLES.entries()) {
      await this.prisma.jobTitle.upsert({
        where: { name },
        create: { name, sortOrder: i },
        update: {},
      });
    }
  }

  private apiUrl() {
    return this.config.get('API_PUBLIC_URL') || 'http://localhost:3000';
  }

  profile(user: { avatarPath?: string | null; [key: string]: any }) {
    return { ...user, avatarUrl: publicFileUrl(this.apiUrl(), user.avatarPath) };
  }

  titles() {
    return this.prisma.jobTitle.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] });
  }

  async addTitle(name: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('Title is required');
    return this.prisma.jobTitle.upsert({
      where: { name: trimmed },
      create: { name: trimmed, sortOrder: 99 },
      update: {},
    });
  }

  async removeTitle(id: string) {
    await this.prisma.jobTitle.delete({ where: { id } });
    return { ok: true };
  }

  staff() {
    return this.prisma.user.findMany({
      where: { role: { not: Role.CLIENT } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        jobTitle: true,
        avatarPath: true,
        isActive: true,
        createdAt: true,
      },
    }).then((rows) => rows.map((r) => this.profile(r)));
  }

  /** Any signed-in user can correct their own display name / phone. */
  async updateMe(actor: AuthUser, body: { name?: string; phone?: string | null }) {
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
      where: { id: actor.id },
      data,
      include: { organization: true },
    });
    const {
      passwordHash: _p,
      refreshTokenHash: _r,
      resetToken: _t,
      resetTokenExpires: _e,
      expoPushToken: _x,
      ...safe
    } = updated;
    return {
      ...safe,
      avatarUrl: publicFileUrl(this.apiUrl(), safe.avatarPath),
    };
  }

  async inviteStaff(body: {
    email: string;
    name: string;
    role: Role;
    phone?: string;
    password?: string;
    jobTitle?: string;
  }) {
    if (body.role === Role.CLIENT) {
      throw new BadRequestException('Use organization invite for clients');
    }
    const existing = await this.prisma.user.findUnique({
      where: { email: body.email.toLowerCase() },
    });
    if (existing) throw new BadRequestException('Email already in use');
    const temp = body.password || `Staff@${Math.random().toString(36).slice(2, 8)}`;
    const passwordHash = await bcrypt.hash(temp, 10);
    if (body.jobTitle) await this.addTitle(body.jobTitle);
    const user = await this.prisma.user.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        phone: body.phone,
        role: body.role,
        jobTitle: body.jobTitle || null,
        passwordHash,
        mustChangePassword: !body.password,
      },
    });
    return { id: user.id, email: user.email, temporaryPassword: body.password ? undefined : temp };
  }

  async updateStaff(
    id: string,
    data: Prisma.UserUpdateInput & { jobTitle?: string },
    actor?: AuthUser,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role === Role.CLIENT) throw new NotFoundException();
    if (actor?.id === id && data.isActive === false) {
      throw new BadRequestException('You cannot disable your own account');
    }
    if (data.role === Role.CLIENT) {
      throw new BadRequestException('Cannot change a staff account to CLIENT');
    }
    if (typeof data.jobTitle === 'string' && data.jobTitle.trim()) {
      await this.addTitle(data.jobTitle);
    }
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        role: data.role,
        isActive: data.isActive,
        jobTitle: data.jobTitle,
      },
      select: { id: true, email: true, name: true, phone: true, role: true, jobTitle: true, avatarPath: true, isActive: true },
    });
    return this.profile(updated);
  }

  /** Super admin set/reset password for an internal staff user. */
  async setStaffPassword(
    id: string,
    body: { password?: string; notify?: boolean },
    actor?: AuthUser,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role === Role.CLIENT) throw new NotFoundException('Staff user not found');

    const provided = String(body.password || '').trim();
    if (provided && provided.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }
    const password = provided || `Staff@${Math.random().toString(36).slice(2, 10)}`;
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
        'Your Intellisoft staff password was updated',
        this.mail.wrap(
          'Password updated',
          `<p>Hi ${user.name},</p><p>A super admin set a new password for your staff account (${user.email}).</p>${
            provided
              ? '<p>Use the password they shared with you to sign in to the CMS.</p>'
              : `<p>Temporary password: <strong>${password}</strong></p><p>Change it after you sign in.</p>`
          }${actor?.email ? `<p>Changed by: ${actor.email}</p>` : ''}`,
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

  async setAvatar(actor: AuthUser, userId: string, file: Express.Multer.File) {
    if (actor.id !== userId && actor.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }
    const target = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new NotFoundException();
    const avatarPath = `uploads/avatars/${file.filename}`.replace(/\\/g, '/');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarPath },
      select: { id: true, email: true, name: true, role: true, jobTitle: true, avatarPath: true, organizationId: true },
    });
    return this.profile(updated);
  }
}
