import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { publicFileUrl } from '../common/utils';

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function hoursBetween(from: Date, to: Date) {
  return Math.round(((to.getTime() - from.getTime()) / 36e5) * 100) / 100;
}

@Injectable()
export class AttendanceService {
  constructor(private prisma: PrismaService) {}

  async punch(user: AuthUser, type: 'IN' | 'OUT', note?: string, source = 'WEB') {
    const today = startOfDay();
    const last = await this.prisma.attendancePunch.findFirst({
      where: { userId: user.id, at: { gte: today } },
      orderBy: { at: 'desc' },
    });
    if (type === 'IN' && last?.type === 'IN') {
      throw new BadRequestException('You are already punched in.');
    }
    if (type === 'OUT' && last?.type !== 'IN') {
      throw new BadRequestException('Punch in first.');
    }
    return this.prisma.attendancePunch.create({
      data: { userId: user.id, type, note, source },
    });
  }

  async mine(userId: string, from?: string, to?: string) {
    const where: Prisma.AttendancePunchWhereInput = { userId };
    if (from || to) {
      where.at = {};
      if (from) where.at.gte = new Date(from);
      if (to) where.at.lte = new Date(to);
    }
    return this.prisma.attendancePunch.findMany({
      where,
      orderBy: { at: 'desc' },
      take: 200,
    });
  }

  async today(userId: string) {
    const punches = await this.prisma.attendancePunch.findMany({
      where: { userId, at: { gte: startOfDay() } },
      orderBy: { at: 'asc' },
    });
    let hours = 0;
    for (let i = 0; i < punches.length; i++) {
      if (punches[i].type === 'IN') {
        const next = punches[i + 1];
        const end = next?.type === 'OUT' ? next.at : new Date();
        hours += hoursBetween(punches[i].at, end);
      }
    }
    const last = punches[punches.length - 1];
    return {
      punches,
      status: last?.type === 'IN' ? 'IN' : 'OUT',
      lastAt: last?.at || null,
      hours: Math.round(hours * 100) / 100,
    };
  }

  async work(user: AuthUser) {
    const userId = user.id;
    const [today, tickets, projects, leaves] = await Promise.all([
      this.today(userId),
      this.prisma.ticket.findMany({
        where: {
          assigneeId: userId,
          status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
        },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 12,
      }),
      this.prisma.project.findMany({
        where: { members: { some: { userId } } },
        include: { organization: { select: { id: true, name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 12,
      }),
      this.prisma.leaveRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);
    let sales: {
      clientCount: number;
      saleCount: number;
      recentSales: any[];
      clients: { id: string; name: string }[];
    } | null = null;
    if (user.role === 'SALES') {
      const [clientCount, saleCount, recentSales, clients] = await Promise.all([
        this.prisma.organization.count({ where: { salesPersonId: userId } }),
        this.prisma.serviceSubscription.count({ where: { soldById: userId } }),
        this.prisma.serviceSubscription.findMany({
          where: { soldById: userId },
          include: {
            organization: { select: { id: true, name: true } },
            catalog: { select: { name: true } },
          },
          orderBy: { soldAt: 'desc' },
          take: 10,
        }),
        this.prisma.organization.findMany({
          where: { salesPersonId: userId },
          select: { id: true, name: true },
          orderBy: { name: 'asc' },
          take: 12,
        }),
      ]);
      sales = { clientCount, saleCount, recentSales, clients };
    }
    return { today, tickets, projects, leaves, sales };
  }

  async team() {
    const staff = await this.prisma.user.findMany({
      where: { role: { not: Role.CLIENT }, isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, email: true, role: true, jobTitle: true, avatarPath: true, phone: true },
    });
    const rows: any[] = [];
    for (const s of staff) {
      const [day, openTickets, projects] = await Promise.all([
        this.today(s.id),
        this.prisma.ticket.count({
          where: { assigneeId: s.id, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] } },
        }),
        this.prisma.project.count({ where: { members: { some: { userId: s.id } } } }),
      ]);
      const api = process.env.API_PUBLIC_URL || 'http://localhost:3000';
      rows.push({ ...s, ...day, openTickets, projects, avatarUrl: publicFileUrl(api, s.avatarPath) });
    }
    return rows;
  }

  async requestLeave(userId: string, body: { fromDate: string; toDate: string; reason: string }) {
    if (!body.fromDate || !body.toDate || !body.reason) {
      throw new BadRequestException('Dates and reason are required');
    }
    return this.prisma.leaveRequest.create({
      data: {
        userId,
        fromDate: new Date(body.fromDate),
        toDate: new Date(body.toDate),
        reason: body.reason,
      },
    });
  }

  leaves(user: AuthUser) {
    const where = user.role === 'SUPER_ADMIN' ? {} : { userId: user.id };
    return this.prisma.leaveRequest.findMany({
      where,
      include: { user: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  setLeave(id: string, status: 'APPROVED' | 'REJECTED') {
    return this.prisma.leaveRequest.update({ where: { id }, data: { status } });
  }
}
