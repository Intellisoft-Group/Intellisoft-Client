import { Injectable, BadRequestException, ForbiddenException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
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

  async updateStaff(id: string, data: Prisma.UserUpdateInput & { jobTitle?: string }) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user || user.role === Role.CLIENT) throw new NotFoundException();
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
