import { unlinkSync } from 'fs';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { mimeFromName, publicFileUrl, resolveUploadPath } from '../common/utils';
import { NotificationsService } from '../notifications/notifications.service';

const authorSelect = { id: true, name: true, role: true, jobTitle: true, avatarPath: true } as const;

@Injectable()
export class ChatService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private notifications: NotificationsService,
  ) {}

  async ensureOrgThread(organizationId: string) {
    const existing = await this.prisma.chatThread.findFirst({
      where: { organizationId, kind: 'ORGANIZATION' },
    });
    if (existing) return existing;
    return this.prisma.chatThread.create({
      data: { kind: 'ORGANIZATION', organizationId },
    });
  }

  async ensureProjectThread(projectId: string, organizationId: string) {
    const existing = await this.prisma.chatThread.findUnique({ where: { projectId } });
    if (existing) return existing;
    return this.prisma.chatThread.create({
      data: { kind: 'PROJECT', organizationId, projectId },
    });
  }

  canSee(user: AuthUser, organizationId: string) {
    if (user.role === 'CLIENT') return user.organizationId === organizationId;
    return true;
  }

  private fileUrl(messageId: string, attachmentPath?: string | null) {
    if (!attachmentPath) return null;
    const api = this.config.get('API_PUBLIC_URL') || 'http://localhost:3000';
    return `${api.replace(/\/$/, '')}/chat/files/${messageId}`;
  }

  private serialize(m: any, userId?: string, extras?: { pinnedId?: string | null; reads?: { userId: string; lastReadAt: Date; user?: { name: string } }[] }) {
    const deleted = Boolean(m.deletedAt);
    const options = (m.pollOptions || []).map((o: any) => ({
      id: o.id,
      text: o.text,
      sortOrder: o.sortOrder,
      votes: o.votes?.length || 0,
      voted: userId ? Boolean(o.votes?.some((v: any) => v.userId === userId)) : false,
    }));
    const grouped: Record<string, { emoji: string; count: number; mine: boolean }> = {};
    for (const r of m.reactions || []) {
      if (!grouped[r.emoji]) grouped[r.emoji] = { emoji: r.emoji, count: 0, mine: false };
      grouped[r.emoji].count += 1;
      if (userId && r.userId === userId) grouped[r.emoji].mine = true;
    }
    const seenBy = (extras?.reads || [])
      .filter((r) => r.userId !== m.authorId && r.lastReadAt >= m.createdAt)
      .map((r) => r.user?.name)
      .filter(Boolean)
      .slice(0, 6);
    return {
      id: m.id,
      threadId: m.threadId,
      authorId: m.authorId,
      author: this.authorOut(m.author),
      kind: m.kind,
      body: deleted ? '' : m.body,
      deleted: deleted,
      editedAt: m.editedAt,
      createdAt: m.createdAt,
      fileName: deleted ? null : m.fileName,
      mimeType: deleted ? null : m.mimeType,
      attachmentUrl: deleted ? null : this.fileUrl(m.id, m.attachmentPath),
      pinned: extras?.pinnedId === m.id,
      reactions: Object.values(grouped),
      seenBy,
      replyTo: m.replyTo
        ? {
            id: m.replyTo.id,
            body: m.replyTo.deletedAt ? '' : m.replyTo.body,
            fileName: m.replyTo.fileName,
            author: this.authorOut(m.replyTo.author),
          }
        : null,
      poll:
        m.kind === 'POLL'
          ? {
              question: deleted ? '' : m.body,
              multiple: m.pollMultiple,
              closed: m.pollClosed,
              options,
              totalVotes: options.reduce((n: number, o: any) => n + o.votes, 0),
            }
          : null,
    };
  }

  private authorOut(author: any) {
    if (!author) return author;
    const api = this.config.get('API_PUBLIC_URL') || 'http://localhost:3000';
    return {
      ...author,
      avatarUrl: publicFileUrl(api, author.avatarPath),
      verified: Boolean(author.role && author.role !== 'CLIENT'),
    };
  }

  private messageInclude() {
    return {
      author: { select: authorSelect },
      replyTo: { include: { author: { select: authorSelect } } },
      pollOptions: { include: { votes: { select: { userId: true } } }, orderBy: { sortOrder: 'asc' as const } },
      reactions: { select: { emoji: true, userId: true } },
    };
  }

  async listThreads(user: AuthUser, ensureOrg?: string) {
    if (ensureOrg && user.role !== 'CLIENT') {
      await this.ensureOrgThread(ensureOrg);
    }
    if (user.role === 'CLIENT' && user.organizationId) {
      await this.ensureOrgThread(user.organizationId);
      const projects = await this.prisma.project.findMany({
        where: { organizationId: user.organizationId },
        select: { id: true, organizationId: true },
      });
      for (const p of projects) {
        await this.ensureProjectThread(p.id, p.organizationId);
      }
    }

    const where = user.role === 'CLIENT' ? { organizationId: user.organizationId || '__none__' } : {};
    const threads = await this.prisma.chatThread.findMany({
      where,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            users: {
              where: { role: 'CLIENT', isActive: true },
              select: { id: true, name: true, email: true },
              orderBy: { createdAt: 'asc' },
              take: 8,
            },
          },
        },
        project: { select: { id: true, name: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { author: { select: authorSelect } },
        },
        reads: { where: { userId: user.id } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const rows: any[] = [];
    for (const t of threads) {
      const lastRead = t.reads[0]?.lastReadAt;
      const unread = await this.prisma.chatMessage.count({
        where: {
          threadId: t.id,
          authorId: { not: user.id },
          createdAt: lastRead ? { gt: lastRead } : undefined,
          deletedAt: null,
        },
      });
      const last = t.messages[0];
      const clients = (t.organization as any)?.users || [];
      const clientNames = clients.map((u: { name?: string }) => (u.name || '').trim()).filter(Boolean);
      const clientLabel =
        clientNames.length === 0
          ? ''
          : clientNames.length === 1
            ? clientNames[0]
            : `${clientNames.slice(0, 2).join(', ')}${clientNames.length > 2 ? ` +${clientNames.length - 2}` : ''}`;

      // Titles are role-aware:
      // - Client org chat → "Intellisoft" (not their own company name)
      // - Staff org chat → client contact name(s)
      // - Project chat → project name for everyone
      let title: string;
      if (t.kind === 'PROJECT') {
        title = t.project?.name || 'Project';
      } else if (user.role === 'CLIENT') {
        title = 'Intellisoft';
      } else {
        title = clientLabel || t.organization.name || 'Client';
      }

      rows.push({
        id: t.id,
        kind: t.kind,
        organizationId: t.organizationId,
        organization: { id: t.organization.id, name: t.organization.name },
        clientName: clientLabel || null,
        clients: clients.map((u: { id: string; name: string; email: string }) => ({
          id: u.id,
          name: u.name,
          email: u.email,
        })),
        projectId: t.projectId,
        project: t.project,
        title,
        lastMessage: last
          ? {
              id: last.id,
              body: last.body || last.fileName || (last.kind === 'POLL' ? 'Poll' : ''),
              createdAt: last.createdAt,
              author: last.author,
            }
          : null,
        unread,
        pinnedMessageId: t.pinnedMessageId,
        updatedAt: t.updatedAt,
      });
    }
    return rows;
  }

  async messages(threadId: string, user: AuthUser, take = 120, since?: string, q?: string) {
    const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } });
    if (!thread || !this.canSee(user, thread.organizationId)) throw new NotFoundException();
    const where: Prisma.ChatMessageWhereInput = { threadId, deletedAt: null };
    if (since) where.createdAt = { gt: new Date(since) };
    if (q?.trim()) {
      where.OR = [
        { body: { contains: q.trim() } },
        { fileName: { contains: q.trim() } },
      ];
    }
    const [rows, reads] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where,
        include: this.messageInclude(),
        orderBy: { createdAt: 'asc' },
        take,
      }),
      this.prisma.chatRead.findMany({
        where: { threadId },
        include: { user: { select: { name: true } } },
      }),
    ]);
    let pinned: any = null;
    if (thread.pinnedMessageId) {
      const pin = await this.prisma.chatMessage.findUnique({
        where: { id: thread.pinnedMessageId },
        include: this.messageInclude(),
      });
      if (pin && !pin.deletedAt) {
        pinned = this.serialize(pin, user.id, { pinnedId: thread.pinnedMessageId, reads });
      }
    }
    return {
      pinned,
      messages: rows.map((m) => this.serialize(m, user.id, { pinnedId: thread.pinnedMessageId, reads })),
    };
  }

  async markRead(threadId: string, user: AuthUser) {
    const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } });
    if (!thread || !this.canSee(user, thread.organizationId)) throw new NotFoundException();
    await this.prisma.chatRead.upsert({
      where: { threadId_userId: { threadId, userId: user.id } },
      update: { lastReadAt: new Date() },
      create: { threadId, userId: user.id, lastReadAt: new Date() },
    });
    return { ok: true };
  }

  async post(
    threadId: string,
    user: AuthUser,
    body: {
      body?: string;
      replyToId?: string;
      kind?: string;
      pollMultiple?: string | boolean;
      pollOptions?: string;
    },
    file?: { path: string; originalname: string; mimetype?: string },
  ) {
    const thread = await this.prisma.chatThread.findUnique({ where: { id: threadId } });
    if (!thread || !this.canSee(user, thread.organizationId)) throw new NotFoundException();

    if (body.kind === 'POLL') {
      let options: string[] = [];
      try {
        options = JSON.parse(body.pollOptions || '[]');
      } catch {
        options = [];
      }
      options = options.map((o) => String(o || '').trim()).filter(Boolean).slice(0, 8);
      const question = (body.body || '').trim();
      if (!question || options.length < 2) throw new BadRequestException('A poll needs a question and at least two options.');
      const message = await this.prisma.chatMessage.create({
        data: {
          threadId,
          authorId: user.id,
          kind: 'POLL',
          body: question,
          pollMultiple: body.pollMultiple === true || body.pollMultiple === 'true',
          pollOptions: { create: options.map((text, i) => ({ text, sortOrder: i })) },
        },
        include: this.messageInclude(),
      });
      await this.afterPost(threadId, thread.organizationId, thread.kind, user, question, message.id);
      return this.serialize(message, user.id);
    }

    const text = (body.body || '').trim();
    if (!text && !file) throw new BadRequestException('Message cannot be empty');
    if (body.replyToId) {
      const parent = await this.prisma.chatMessage.findFirst({ where: { id: body.replyToId, threadId } });
      if (!parent) throw new BadRequestException('Reply target was not found');
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        threadId,
        authorId: user.id,
        kind: 'TEXT',
        body: text,
        replyToId: body.replyToId || null,
        attachmentPath: file ? file.path.replace(/\\/g, '/') : null,
        fileName: file?.originalname,
        mimeType: file ? mimeFromName(file.originalname, file.mimetype) : null,
      },
      include: this.messageInclude(),
    });
    const preview = text || `Shared a file: ${file?.originalname}`;
    await this.afterPost(threadId, thread.organizationId, thread.kind, user, preview, message.id);
    return this.serialize(message, user.id);
  }

  private async afterPost(
    threadId: string,
    organizationId: string,
    kind: string,
    user: AuthUser,
    preview: string,
    messageId: string,
  ) {
    await this.prisma.chatThread.update({ where: { id: threadId }, data: { updatedAt: new Date() } });
    // Only staff → client messages alert the mobile app. Clients who are logged in get the push.
    if (user.role === 'CLIENT') return;
    const title = kind === 'PROJECT' ? 'New project message' : 'New message from Intellisoft';
    try {
      await this.notifications.notifyLoggedInClients(
        organizationId,
        title,
        preview.slice(0, 180),
        'CHAT_MESSAGE',
        messageId,
      );
    } catch {
      // Chat must succeed even if push/inbox fails.
    }
  }

  async unreadTotal(user: AuthUser) {
    const where =
      user.role === 'CLIENT'
        ? { organizationId: user.organizationId || '__none__' }
        : {};
    const threads = await this.prisma.chatThread.findMany({
      where,
      select: { id: true, reads: { where: { userId: user.id }, select: { lastReadAt: true } } },
    });
    let total = 0;
    for (const t of threads) {
      const lastRead = t.reads[0]?.lastReadAt;
      total += await this.prisma.chatMessage.count({
        where: {
          threadId: t.id,
          authorId: { not: user.id },
          deletedAt: null,
          createdAt: lastRead ? { gt: lastRead } : undefined,
        },
      });
    }
    return { unread: total };
  }

  async vote(messageId: string, user: AuthUser, optionId: string) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { thread: true, pollOptions: { include: { votes: true } } },
    });
    if (!message || message.kind !== 'POLL' || !this.canSee(user, message.thread.organizationId)) {
      throw new NotFoundException();
    }
    if (message.pollClosed || message.deletedAt) throw new BadRequestException('This poll is closed.');
    const option = message.pollOptions.find((o) => o.id === optionId);
    if (!option) throw new BadRequestException('Invalid option');

    const already = option.votes.some((v) => v.userId === user.id);
    if (already) {
      await this.prisma.chatPollVote.deleteMany({ where: { optionId, userId: user.id } });
    } else {
      if (!message.pollMultiple) {
        await this.prisma.chatPollVote.deleteMany({
          where: { userId: user.id, option: { messageId } },
        });
      }
      await this.prisma.chatPollVote.create({ data: { optionId, userId: user.id } });
    }
    const fresh = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: this.messageInclude(),
    });
    return this.serialize(fresh, user.id);
  }

  async react(id: string, user: AuthUser, emoji: string) {
    const allowed = ['👍', '✅', '👀', '🎉', '❗'];
    if (!allowed.includes(emoji)) throw new BadRequestException('Unsupported reaction');
    const message = await this.prisma.chatMessage.findUnique({ where: { id }, include: { thread: true } });
    if (!message || message.deletedAt || !this.canSee(user, message.thread.organizationId)) throw new NotFoundException();
    const existing = await this.prisma.chatReaction.findUnique({
      where: { messageId_userId_emoji: { messageId: id, userId: user.id, emoji } },
    });
    if (existing) await this.prisma.chatReaction.delete({ where: { id: existing.id } });
    else await this.prisma.chatReaction.create({ data: { messageId: id, userId: user.id, emoji } });
    const fresh = await this.prisma.chatMessage.findUnique({ where: { id }, include: this.messageInclude() });
    return this.serialize(fresh, user.id);
  }

  async pin(id: string, user: AuthUser) {
    if (user.role === 'CLIENT') throw new ForbiddenException('Only staff can pin messages.');
    const message = await this.prisma.chatMessage.findUnique({ where: { id }, include: { thread: true } });
    if (!message || message.deletedAt || !this.canSee(user, message.thread.organizationId)) throw new NotFoundException();
    const next = message.thread.pinnedMessageId === id ? null : id;
    await this.prisma.chatThread.update({ where: { id: message.threadId }, data: { pinnedMessageId: next } });
    return { ok: true, pinnedMessageId: next };
  }

  async edit(id: string, user: AuthUser, body: string) {
    const message = await this.prisma.chatMessage.findUnique({ where: { id }, include: { thread: true } });
    if (!message || !this.canSee(user, message.thread.organizationId)) throw new NotFoundException();
    if (message.authorId !== user.id) throw new ForbiddenException();
    if (message.kind === 'POLL' || message.deletedAt) throw new BadRequestException('This message cannot be edited');
    const updated = await this.prisma.chatMessage.update({
      where: { id },
      data: { body: body.trim(), editedAt: new Date() },
      include: {
        author: { select: authorSelect },
        replyTo: { include: { author: { select: authorSelect } } },
        pollOptions: { include: { votes: { select: { userId: true } } } },
      },
    });
    return this.serialize(updated, user.id);
  }

  async remove(id: string, user: AuthUser) {
    if (user.role !== 'SUPER_ADMIN') throw new ForbiddenException('Only admin can delete chat messages.');
    const message = await this.prisma.chatMessage.findUnique({ where: { id }, include: { thread: true } });
    if (!message || !this.canSee(user, message.thread.organizationId)) throw new NotFoundException();
    if (message.attachmentPath) {
      const disk = resolveUploadPath(message.attachmentPath);
      if (disk) {
        try { unlinkSync(disk); } catch { /* file already gone */ }
      }
    }
    const preview =
      (message.body || '').trim().slice(0, 180) ||
      (message.fileName ? `Shared a file: ${message.fileName}` : '');
    await this.prisma.chatMessage.delete({ where: { id } });
    // Also clear the matching rows from the client bell / notifications list.
    await this.notifications
      .deleteForChatMessage({
        messageId: id,
        organizationId: message.thread.organizationId,
        body: preview,
        createdAt: message.createdAt,
      })
      .catch(() => undefined);
    return { ok: true, id };
  }

  async openFile(messageId: string, user: AuthUser) {
    const message = await this.prisma.chatMessage.findUnique({
      where: { id: messageId },
      include: { thread: true },
    });
    if (!message?.attachmentPath || message.deletedAt || !this.canSee(user, message.thread.organizationId)) {
      throw new NotFoundException('File not found');
    }
    const disk = resolveUploadPath(message.attachmentPath);
    if (!disk) throw new NotFoundException('File is missing on the server');
    return {
      disk,
      fileName: message.fileName || 'attachment',
      mimeType: mimeFromName(message.fileName, message.mimeType || undefined),
    };
  }
}
