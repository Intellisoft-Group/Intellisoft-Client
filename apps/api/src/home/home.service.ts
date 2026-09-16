import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { money, publicFileUrl } from '../common/utils';

@Injectable()
export class HomeService {
  private readonly log = new Logger(HomeService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  async clientHome(user: AuthUser) {
    const orgId = user.organizationId || '__none__';
    const apiUrl = this.config.get('API_PUBLIC_URL') || 'http://localhost:3000';
    const me = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        avatarPath: true,
        organization: { select: { id: true, name: true } },
      },
    });

    const openInvoices = await this.prisma.invoice.findMany({
      where: { organizationId: orgId, status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
      take: 6,
    });
    const paidInvoices = await this.prisma.invoice.findMany({
      where: { organizationId: orgId, status: 'PAID' },
      orderBy: { updatedAt: 'desc' },
      take: 4,
    });
    const services = await this.prisma.serviceSubscription.count({
      where: { organizationId: orgId, status: 'ACTIVE' },
    });
    const tickets = await this.prisma.ticket.count({
      where: {
        organizationId: orgId,
        status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] },
      },
    });
    const banners = await this.prisma.appBanner.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    let notifications = 0;
    try {
      notifications = await this.prisma.notification.count({
        where: {
          read: false,
          OR: [{ userId: user.id }, { organizationId: orgId, userId: null }],
        },
      });
    } catch (e: any) {
      this.log.warn(`Home notification count failed: ${e?.message || e}`);
    }

    let unreadChat = 0;
    try {
      const chatThreads = await this.prisma.chatThread.findMany({
        where: { organizationId: orgId },
        select: { id: true, reads: { where: { userId: user.id }, select: { lastReadAt: true } } },
      });
      for (const t of chatThreads) {
        const lastRead = t.reads[0]?.lastReadAt;
        unreadChat += await this.prisma.chatMessage.count({
          where: {
            threadId: t.id,
            authorId: { not: user.id },
            deletedAt: null,
            createdAt: lastRead ? { gt: lastRead } : undefined,
          },
        });
      }
    } catch (e: any) {
      this.log.warn(`Home unread chat failed: ${e?.message || e}`);
    }

    const invoices = [...openInvoices, ...paidInvoices];
    const unpaid = openInvoices;
    const dueTotal = unpaid.reduce((s, i) => s + money(i.amountDue), 0);
    const overdue = unpaid.filter((i) => i.status === 'OVERDUE');

    return {
      user: me
        ? {
            id: me.id,
            name: me.name,
            email: me.email,
            avatarPath: me.avatarPath,
            avatarUrl: publicFileUrl(apiUrl, me.avatarPath),
            organization: me.organization,
          }
        : null,
      dueTotal,
      overdueCount: overdue.length,
      unpaidCount: unpaid.length,
      activeServices: services,
      openTickets: tickets,
      unreadNotifications: notifications,
      unreadChat,
      invoices: invoices.map((i) => ({
        id: i.id,
        number: i.number,
        status: i.status,
        currency: i.currency,
        total: money(i.total),
        amountDue: money(i.amountDue),
        dueDate: i.dueDate,
      })),
      banners,
    };
  }
}
