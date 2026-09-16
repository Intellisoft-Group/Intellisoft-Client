import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthUser } from '../common/current-user.decorator';
import { mimeFromName, nextNumber, resolveUploadPath } from '../common/utils';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class TicketsService {
  constructor(
    private prisma: PrismaService,
    private mail: MailService,
    private notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, status?: string, mine?: string) {
    const where: Prisma.TicketWhereInput = {};
    if (user.role === 'CLIENT') where.organizationId = user.organizationId || '__none__';
    else if (mine === '1' && user.role !== 'SUPER_ADMIN') where.assigneeId = user.id;
    if (status) where.status = status as any;
    return this.prisma.ticket.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, jobTitle: true, avatarPath: true } },
        subscription: { include: { catalog: { select: { name: true } } } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async get(id: string, user: AuthUser) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id },
      include: {
        organization: true,
        assignee: { select: { id: true, name: true, email: true, jobTitle: true, avatarPath: true } },
        subscription: { include: { catalog: true } },
        invoice: { select: { id: true, number: true } },
        messages: { include: { author: { select: { id: true, name: true, role: true, jobTitle: true, avatarPath: true } } }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!ticket) throw new NotFoundException();
    if (user.role === 'CLIENT' && ticket.organizationId !== user.organizationId) {
      throw new NotFoundException();
    }
    return ticket;
  }

  private async allocateTicketNumber() {
    const year = new Date().getFullYear();
    const prefix = `TCK-${year}-`;
    const latest = await this.prisma.ticket.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    const seq = latest?.number ? Number(latest.number.slice(prefix.length)) || 0 : 0;
    return nextNumber('TCK', seq + 1, year);
  }

  async create(user: AuthUser, body: any) {
    const organizationId =
      user.role === 'CLIENT' ? user.organizationId : body.organizationId;
    const data = {
      organizationId,
      subscriptionId: body.subscriptionId || null,
      invoiceId: body.invoiceId || null,
      subject: body.subject,
      priority: body.priority || 'MEDIUM',
      messages: {
        create: { authorId: user.id, body: body.body || body.subject },
      },
    };
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const ticket = await this.prisma.ticket.create({
          data: { ...data, number: await this.allocateTicketNumber() },
        });
        return this.get(ticket.id, user);
      } catch (e: any) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt < 4) {
          continue;
        }
        throw e;
      }
    }
    throw new NotFoundException('Could not allocate ticket number');
  }

  async reply(id: string, user: AuthUser, body: string, attachment?: string) {
    await this.get(id, user);
    await this.prisma.ticketMessage.create({
      data: { ticketId: id, authorId: user.id, body, attachment },
    });
    const status = user.role === 'CLIENT' ? 'WAITING' : 'IN_PROGRESS';
    await this.prisma.ticket.update({ where: { id }, data: { status: status as any } });
    if (user.role !== 'CLIENT') {
      const t = await this.prisma.ticket.findUnique({
        where: { id },
        include: { organization: true },
      });
      await this.notifications.notifyOrganizationClients({
        organizationId: t!.organizationId,
        type: 'TICKET_REPLY',
        title: `Reply on ${t!.number}`,
        body: body.slice(0, 180),
      }).catch(() => undefined);
      await this.mail.send(
        t!.organization.email,
        `Update on ticket ${t!.number}`,
        this.mail.wrap(`Ticket ${t!.number}`, `<p>Intellisoft replied:</p><p>${body.slice(0, 400)}</p>`),
      );
    }
    return this.get(id, user);
  }

  async openAttachment(messageId: string, user: AuthUser) {
    const message = await this.prisma.ticketMessage.findUnique({
      where: { id: messageId },
      include: { ticket: true },
    });
    if (!message?.attachment || !message.ticket) throw new NotFoundException('File not found');
    if (user.role === 'CLIENT' && message.ticket.organizationId !== user.organizationId) {
      throw new ForbiddenException();
    }
    const disk = resolveUploadPath(message.attachment);
    if (!disk) throw new NotFoundException('File is missing on the server');
    const fileName = message.attachment.split('/').pop() || 'attachment';
    return {
      disk,
      fileName,
      mimeType: mimeFromName(fileName),
    };
  }

  async update(id: string, data: any) {
    return this.prisma.ticket.update({
      where: { id },
      data: {
        status: data.status,
        priority: data.priority,
        assigneeId: data.assigneeId,
      },
    });
  }
}
