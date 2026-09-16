import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { money } from '../common/utils';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async dashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [
      orgs,
      unpaid,
      overdue,
      tickets,
      renewals,
      payments,
      monthPay,
      prevPay,
      recentTickets,
      renewalRows,
      openChats,
      activeProjects,
      urgentTickets,
      newLeads,
      staffCount,
      recentPayments,
      recentChat,
      agingInvoices,
      mixSubs,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.invoice.aggregate({
        where: { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
        _sum: { amountDue: true },
        _count: true,
      }),
      this.prisma.invoice.aggregate({
        where: { status: 'OVERDUE' },
        _sum: { amountDue: true },
        _count: true,
      }),
      this.prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] } } }),
      this.prisma.serviceSubscription.count({
        where: {
          status: 'ACTIVE',
          renewalDate: { lte: new Date(Date.now() + 30 * 86400000), gte: now },
        },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED' },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', paidAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: { status: 'SUCCEEDED', paidAt: { gte: prevStart, lt: monthStart } },
        _sum: { amount: true },
      }),
      this.prisma.ticket.findMany({
        where: { status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] } },
        include: { organization: { select: { name: true } } },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      this.prisma.serviceSubscription.findMany({
        where: {
          status: 'ACTIVE',
          renewalDate: { lte: new Date(Date.now() + 30 * 86400000), gte: now },
        },
        include: { organization: { select: { name: true } }, catalog: { select: { name: true } } },
        orderBy: { renewalDate: 'asc' },
        take: 6,
      }),
      this.prisma.chatThread.count(),
      this.prisma.project.count({ where: { status: { in: ['PLANNED', 'IN_PROGRESS'] } } }),
      this.prisma.ticket.count({ where: { priority: { in: ['HIGH', 'URGENT'] }, status: { in: ['OPEN', 'IN_PROGRESS', 'WAITING'] } } }),
      this.prisma.serviceRequest.count({ where: { status: 'NEW' } }),
      this.prisma.user.count({ where: { role: { not: 'CLIENT' }, isActive: true } }),
      this.prisma.payment.findMany({
        where: { status: 'SUCCEEDED' },
        include: { organization: { select: { name: true } } },
        orderBy: { paidAt: 'desc' },
        take: 5,
      }),
      this.prisma.chatMessage.findMany({
        where: { deletedAt: null },
        include: { author: { select: { name: true, role: true } }, thread: { include: { organization: { select: { name: true } }, project: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      this.prisma.invoice.findMany({
        where: { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
        select: { dueDate: true, amountDue: true },
      }),
      this.prisma.serviceSubscription.findMany({
        where: { status: 'ACTIVE' },
        include: { catalog: { select: { category: true } } },
      }),
    ]);

    const buckets = { current: 0, d30: 0, d60: 0, older: 0 };
    for (const inv of agingInvoices) {
      const days = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000);
      const due = money(inv.amountDue);
      if (days <= 0) buckets.current += due;
      else if (days <= 30) buckets.d30 += due;
      else if (days <= 60) buckets.d60 += due;
      else buckets.older += due;
    }
    const serviceMix: Record<string, number> = {};
    for (const s of mixSubs) {
      const key = s.catalog?.category || 'Other';
      serviceMix[key] = (serviceMix[key] || 0) + 1;
    }

    return {
      clients: orgs,
      unpaidCount: unpaid._count,
      unpaidTotal: money(unpaid._sum.amountDue),
      overdueCount: overdue._count,
      overdueTotal: money(overdue._sum.amountDue),
      openTickets: tickets,
      urgentTickets,
      upcomingRenewals: renewals,
      collected: money(payments._sum.amount),
      collectedMonth: money(monthPay._sum.amount),
      collectedPrev: money(prevPay._sum.amount),
      openChats,
      activeProjects,
      newLeads,
      staffCount,
      recentTickets,
      renewalRows,
      aging: buckets,
      serviceMix,
      recentPayments: recentPayments.map((p) => ({
        id: p.id,
        amount: money(p.amount),
        client: p.organization?.name,
        at: p.paidAt || p.createdAt,
      })),
      recentChat: recentChat.map((m) => ({
        id: m.id,
        body: m.body || m.fileName || (m.kind === 'POLL' ? 'Poll' : 'Message'),
        author: m.author?.name,
        role: m.author?.role,
        client: m.thread.project?.name || m.thread.organization?.name,
        at: m.createdAt,
      })),
    };
  }

  async revenue() {
    const payments = await this.prisma.payment.findMany({
      where: { status: 'SUCCEEDED' },
      orderBy: { paidAt: 'desc' },
    });
    const byMonth: Record<string, number> = {};
    for (const p of payments) {
      const key = (p.paidAt || p.createdAt).toISOString().slice(0, 7);
      byMonth[key] = (byMonth[key] || 0) + money(p.amount);
    }
    return {
      payments: payments.map((p) => ({ ...p, amount: money(p.amount) })),
      byMonth,
    };
  }

  async gstSummary() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { notIn: ['DRAFT', 'VOID'] }, type: 'TAX' },
    });
    return {
      count: invoices.length,
      taxable: invoices.reduce((s, i) => s + money(i.subtotal), 0),
      cgst: invoices.reduce((s, i) => s + money(i.cgst), 0),
      sgst: invoices.reduce((s, i) => s + money(i.sgst), 0),
      igst: invoices.reduce((s, i) => s + money(i.igst), 0),
      total: invoices.reduce((s, i) => s + money(i.total), 0),
    };
  }

  async aging() {
    const invoices = await this.prisma.invoice.findMany({
      where: { status: { in: ['SENT', 'PARTIAL', 'OVERDUE'] } },
      include: { organization: { select: { name: true } } },
    });
    const buckets = { current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
    const now = Date.now();
    const rows = invoices.map((inv) => {
      const days = Math.floor((now - inv.dueDate.getTime()) / 86400000);
      const due = money(inv.amountDue);
      if (days <= 0) buckets.current += due;
      else if (days <= 30) buckets.d30 += due;
      else if (days <= 60) buckets.d60 += due;
      else if (days <= 90) buckets.d90 += due;
      else buckets.older += due;
      return {
        id: inv.id,
        number: inv.number,
        client: inv.organization.name,
        amountDue: due,
        daysOverdue: Math.max(0, days),
        dueDate: inv.dueDate,
      };
    });
    return { buckets, rows };
  }

  async serviceMix() {
    const subs = await this.prisma.serviceSubscription.findMany({
      where: { status: 'ACTIVE' },
      include: { catalog: true },
    });
    const map: Record<string, number> = {};
    for (const s of subs) {
      map[s.catalog.category] = (map[s.catalog.category] || 0) + 1;
    }
    return map;
  }

  async salesTracking() {
    const [staff, sales, ownedClients, unassigned] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: 'SALES', isActive: true },
        select: { id: true, name: true, email: true, phone: true, jobTitle: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.serviceSubscription.findMany({
        where: { soldById: { not: null } },
        include: {
          soldBy: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
          catalog: { select: { name: true, category: true } },
        },
        orderBy: [{ soldAt: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.organization.findMany({
        where: { salesPersonId: { not: null } },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          salesPersonId: true,
          _count: { select: { subscriptions: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.organization.findMany({
        where: { salesPersonId: null },
        select: { id: true, name: true, email: true, phone: true },
        orderBy: { name: 'asc' },
      }),
    ]);

    type Person = {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      jobTitle: string | null;
      clientCount: number;
      saleCount: number;
      clients: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        subscriptionCount: number;
      }[];
      services: {
        id: string;
        service: string;
        category: string | null;
        client: string;
        clientId: string;
        status: string;
        soldAt: Date;
      }[];
    };

    const people = new Map<string, Person>();
    for (const s of staff) {
      people.set(s.id, {
        ...s,
        clientCount: 0,
        saleCount: 0,
        clients: [],
        services: [],
      });
    }

    for (const org of ownedClients) {
      const id = org.salesPersonId!;
      if (!people.has(id)) {
        people.set(id, {
          id,
          name: 'Unknown',
          email: '',
          phone: null,
          jobTitle: null,
          clientCount: 0,
          saleCount: 0,
          clients: [],
          services: [],
        });
      }
      const person = people.get(id)!;
      person.clients.push({
        id: org.id,
        name: org.name,
        email: org.email,
        phone: org.phone,
        subscriptionCount: org._count.subscriptions,
      });
      person.clientCount = person.clients.length;
    }

    const missingIds = Array.from(people.values())
      .filter((p) => p.name === 'Unknown' || !p.email)
      .map((p) => p.id);
    if (missingIds.length) {
      const extras = await this.prisma.user.findMany({
        where: { id: { in: missingIds } },
        select: { id: true, name: true, email: true, phone: true, jobTitle: true },
      });
      for (const u of extras) {
        const person = people.get(u.id);
        if (!person) continue;
        person.name = u.name;
        person.email = u.email;
        person.phone = u.phone;
        person.jobTitle = u.jobTitle;
      }
    }

    for (const sale of sales) {
      const id = sale.soldById!;
      if (!people.has(id)) {
        people.set(id, {
          id,
          name: sale.soldBy?.name || 'Unknown',
          email: sale.soldBy?.email || '',
          phone: null,
          jobTitle: null,
          clientCount: 0,
          saleCount: 0,
          clients: [],
          services: [],
        });
      }
      const person = people.get(id)!;
      person.services.push({
        id: sale.id,
        service: sale.catalog?.name || 'Service',
        category: sale.catalog?.category || null,
        client: sale.organization?.name || '—',
        clientId: sale.organizationId,
        status: sale.status,
        soldAt: sale.soldAt || sale.createdAt,
      });
      person.saleCount = person.services.length;
    }

    const summary = Array.from(people.values()).sort(
      (a, b) => b.saleCount - a.saleCount || b.clientCount - a.clientCount || a.name.localeCompare(b.name),
    );

    return {
      totals: {
        salesPeople: summary.length,
        clientAccounts: ownedClients.length,
        servicesSold: sales.length,
        unassignedClients: unassigned.length,
      },
      summary,
      sales: sales.map((s) => ({
        id: s.id,
        soldAt: s.soldAt || s.createdAt,
        status: s.status,
        salesPerson: s.soldBy?.name,
        salesPersonId: s.soldById,
        client: s.organization?.name,
        clientId: s.organizationId,
        service: s.catalog?.name,
        category: s.catalog?.category,
      })),
      unassignedClients: unassigned.length,
      unassigned,
    };
  }
}
