import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { money, publicFileUrl, round2 } from '../common/utils';
import { InvoicesService } from '../invoices/invoices.service';
import { NotificationsService } from '../notifications/notifications.service';

const DEFAULT_STAGES: { title: string; percent: number; dueDate?: string }[] = [
  { title: 'Stage 1 — Advance / kickoff', percent: 40 },
  { title: 'Stage 2 — Mid delivery', percent: 40 },
  { title: 'Stage 3 — Final delivery', percent: 20 },
];

@Injectable()
export class ProjectsService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private invoices: InvoicesService,
    private notifications: NotificationsService,
  ) {}

  list(user: AuthUser, organizationId?: string, mine?: string) {
    const where: Prisma.ProjectWhereInput = {};
    if (user.role === 'CLIENT') where.organizationId = user.organizationId || '__none__';
    else if (organizationId) where.organizationId = organizationId;
    else if (mine === '1' && user.role !== 'SUPER_ADMIN') {
      where.members = { some: { userId: user.id } };
    }
    return this.prisma.project
      .findMany({
        where,
        include: {
          organization: { select: { id: true, name: true } },
          milestones: { orderBy: { sortOrder: 'asc' } },
          paymentStages: {
            orderBy: { sortOrder: 'asc' },
            include: { invoice: { select: { id: true, number: true, status: true, amountDue: true, total: true, pdfPath: true } } },
          },
          chatThread: { select: { id: true } },
          _count: { select: { updates: true, documents: true, members: true } },
        },
        orderBy: { updatedAt: 'desc' },
      })
      .then((rows) => rows.map((p) => this.serializeProject(p)));
  }

  async get(id: string, user: AuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        organization: true,
        milestones: { orderBy: { sortOrder: 'asc' } },
        paymentStages: {
          orderBy: { sortOrder: 'asc' },
          include: { invoice: { select: { id: true, number: true, status: true, amountDue: true, total: true, amountPaid: true, pdfPath: true } } },
        },
        updates: { orderBy: { createdAt: 'desc' } },
        members: { include: { user: { select: { id: true, name: true, email: true, role: true, jobTitle: true, avatarPath: true } } } },
        documents: {
          include: { uploadedBy: { select: { id: true, name: true, role: true, jobTitle: true, avatarPath: true } } },
          orderBy: { createdAt: 'desc' },
        },
        chatThread: { select: { id: true } },
      },
    });
    if (!project) throw new NotFoundException();
    if (user.role === 'CLIENT' && project.organizationId !== user.organizationId) {
      throw new NotFoundException();
    }
    if (!project.chatThread) {
      const thread = await this.prisma.chatThread.create({
        data: { kind: 'PROJECT', organizationId: project.organizationId, projectId: project.id },
      });
      (project as any).chatThread = { id: thread.id };
    }
    const lastMessage = await this.prisma.chatMessage.findFirst({
      where: { threadId: (project as any).chatThread.id },
      orderBy: { createdAt: 'desc' },
      include: { author: { select: { id: true, name: true, role: true, jobTitle: true, avatarPath: true } } },
    });
    const api = this.config.get('API_PUBLIC_URL') || 'http://localhost:3000';
    const serialized = this.serializeProject(project);
    return {
      ...serialized,
      members: project.members.map((m) => ({
        ...m,
        user: m.user ? { ...m.user, avatarUrl: publicFileUrl(api, m.user.avatarPath) } : m.user,
      })),
      lastMessage,
      files: project.documents.map((d) => {
        const fileUrl = `${api.replace(/\/$/, '')}/documents/${d.id}/file`;
        return {
          id: d.id,
          title: d.title,
          type: d.type,
          source: d.source,
          fileName: d.fileName,
          mimeType: d.mimeType,
          createdAt: d.createdAt,
          url: fileUrl,
          staticUrl: fileUrl,
          fileUrl,
          openPath: `/documents/${d.id}/file`,
          uploadedBy: d.uploadedBy
            ? { ...d.uploadedBy, avatarUrl: publicFileUrl(api, d.uploadedBy.avatarPath) }
            : null,
        };
      }),
    };
  }

  private serializeProject(project: any) {
    const contractAmount = project.contractAmount == null ? null : money(project.contractAmount);
    const stages = (project.paymentStages || []).map((s: any) => ({
      id: s.id,
      projectId: s.projectId,
      title: s.title,
      percent: money(s.percent),
      amount: money(s.amount),
      sortOrder: s.sortOrder,
      status: s.status,
      dueDate: s.dueDate,
      invoiceId: s.invoiceId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      invoice: s.invoice
        ? (() => {
            const { pdfPath: _pdfPath, ...inv } = s.invoice;
            return {
              id: inv.id,
              number: inv.number,
              status: inv.status,
              total: inv.total == null ? undefined : money(inv.total),
              amountDue: inv.amountDue == null ? undefined : money(inv.amountDue),
              amountPaid: inv.amountPaid == null ? undefined : money(inv.amountPaid),
              ...this.invoices.clientPdfMeta(s.invoice),
            };
          })()
        : null,
    }));
    const paidAmount = round2(stages.filter((s: any) => s.status === 'PAID').reduce((a: number, s: any) => a + Number(s.amount), 0));
    const dueNow = round2(
      stages
        .filter((s: any) => s.status === 'INVOICED')
        .reduce((a: number, s: any) => a + Number(s.invoice?.amountDue ?? s.amount), 0),
    );
    const plannedAmount = round2(stages.filter((s: any) => s.status === 'PLANNED').reduce((a: number, s: any) => a + Number(s.amount), 0));
    return {
      id: project.id,
      organizationId: project.organizationId,
      organization: project.organization
        ? { id: project.organization.id, name: project.organization.name }
        : project.organization,
      name: project.name,
      description: project.description,
      status: project.status,
      currency: project.currency || 'INR',
      startDate: project.startDate,
      dueDate: project.dueDate,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      milestones: project.milestones || [],
      updates: project.updates,
      members: project.members,
      documents: project.documents,
      chatThread: project.chatThread,
      _count: project._count,
      contractAmount,
      taxPercent: money(project.taxPercent ?? 18),
      paymentStages: stages,
      paymentSummary:
        contractAmount == null
          ? null
          : {
              contractAmount,
              currency: project.currency || 'INR',
              paidAmount,
              dueNow,
              plannedAmount,
              remainingAmount: round2(Math.max(0, contractAmount - paidAmount)),
            },
    };
  }

  private authorLabel(role?: string | null) {
    if (role === 'CLIENT') return 'Client';
    if (role === 'SUPER_ADMIN') return 'Admin';
    if (role === 'FINANCE') return 'Finance';
    if (role === 'SALES') return 'Sales';
    if (role === 'SUPPORT') return 'Team';
    return 'Team';
  }

  async files(id: string, user: AuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { organization: { select: { id: true, name: true } } },
    });
    if (!project) throw new NotFoundException();
    if (user.role === 'CLIENT' && project.organizationId !== user.organizationId) {
      throw new NotFoundException();
    }

    const [documents, thread] = await Promise.all([
      this.prisma.document.findMany({
        where: { projectId: id },
        include: { uploadedBy: { select: { id: true, name: true, role: true, jobTitle: true, avatarPath: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.chatThread.findFirst({ where: { projectId: id }, select: { id: true } }),
    ]);

    const chatFiles = thread
      ? await this.prisma.chatMessage.findMany({
          where: {
            threadId: thread.id,
            deletedAt: null,
            attachmentPath: { not: null },
          },
          include: { author: { select: { id: true, name: true, role: true, jobTitle: true, avatarPath: true } } },
          orderBy: { createdAt: 'asc' },
        })
      : [];

    const api = this.config.get('API_PUBLIC_URL') || 'http://localhost:3000';
    const authorOut = (author: any) =>
      author ? { ...author, avatarUrl: publicFileUrl(api, author.avatarPath) } : author;
    const files = [
      ...documents.map((d) => ({
        id: d.id,
        kind: 'document' as const,
        title: d.title,
        type: d.type,
        source: d.source,
        fileName: d.fileName || d.title,
        mimeType: d.mimeType,
        createdAt: d.createdAt,
        caption: null as string | null,
        author: authorOut(d.uploadedBy),
        authorLabel: this.authorLabel(d.uploadedBy?.role),
        openPath: `/documents/${d.id}/file`,
      })),
      ...chatFiles
        .filter((m) => !!m.attachmentPath)
        .map((m) => ({
          id: m.id,
          kind: 'chat' as const,
          title: m.fileName || m.body || 'Attachment',
          fileName: m.fileName || 'Attachment',
          mimeType: m.mimeType,
          createdAt: m.createdAt,
          caption: m.body || null,
          author: authorOut(m.author),
          authorLabel: this.authorLabel(m.author?.role),
          openPath: `/chat/files/${m.id}`,
        })),
    ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    return {
      project: {
        id: project.id,
        name: project.name,
        status: project.status,
        organizationId: project.organizationId,
        organization: project.organization,
        chatThreadId: thread?.id || null,
      },
      files,
    };
  }

  async create(data: any) {
    const project = await this.prisma.project.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        description: data.description,
        status: data.status || 'PLANNED',
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        milestones: data.milestones
          ? { create: data.milestones.map((m: any, i: number) => ({ ...m, sortOrder: i })) }
          : undefined,
      },
      include: { milestones: true },
    });
    await this.prisma.chatThread.create({
      data: { kind: 'PROJECT', organizationId: project.organizationId, projectId: project.id },
    });
    return project;
  }

  update(id: string, data: any) {
    return this.prisma.project.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        status: data.status,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      },
    });
  }

  async addMilestone(id: string, body: any) {
    return this.prisma.milestone.create({
      data: {
        projectId: id,
        title: body.title,
        description: body.description,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        completed: !!body.completed,
        sortOrder: body.sortOrder || 0,
      },
    });
  }

  toggleMilestone(milestoneId: string, completed: boolean) {
    return this.prisma.milestone.update({
      where: { id: milestoneId },
      data: { completed },
    });
  }

  async addUpdate(id: string, body: string) {
    const update = await this.prisma.projectUpdate.create({
      data: { projectId: id, body },
    });
    const project = await this.prisma.project.findUnique({ where: { id } });
    await this.notifications.notifyOrganizationClients({
      organizationId: project!.organizationId,
      type: 'PROJECT_UPDATE',
      title: `Update: ${project!.name}`,
      body: body.slice(0, 180),
    }).catch(() => undefined);
    return update;
  }

  async addMember(projectId: string, userId: string) {
    if (!userId) throw new BadRequestException('Select a person to assign');
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException();
    const person = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!person || !person.isActive) throw new BadRequestException('That account is not available');
    const staff = person.role !== 'CLIENT';
    const clientOfThisCompany = person.role === 'CLIENT' && person.organizationId === project.organizationId;
    if (!staff && !clientOfThisCompany) {
      throw new BadRequestException('Assign staff or a user from this client company');
    }
    return this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId },
      update: {},
      include: { user: { select: { id: true, name: true, email: true, role: true, jobTitle: true, avatarPath: true } } },
    });
  }

  async removeMember(projectId: string, userId: string) {
    const existing = await this.prisma.projectMember.findFirst({ where: { projectId, userId } });
    if (!existing) throw new NotFoundException('That person is not on this project');
    await this.prisma.projectMember.delete({ where: { id: existing.id } });
    return { ok: true };
  }

  async setPaymentSchedule(
    projectId: string,
    body: {
      contractAmount: number;
      currency?: string;
      taxPercent?: number;
      stages?: { title: string; percent: number; dueDate?: string }[];
    },
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { paymentStages: true },
    });
    if (!project) throw new NotFoundException();

    const contractAmount = round2(Number(body.contractAmount));
    if (!Number.isFinite(contractAmount) || contractAmount <= 0) {
      throw new BadRequestException('Enter a valid project contract amount');
    }

    const taxPercent = body.taxPercent == null ? money(project.taxPercent ?? 18) : Number(body.taxPercent);
    if (!Number.isFinite(taxPercent) || taxPercent < 0) {
      throw new BadRequestException('Enter a valid tax percent');
    }

    const inputStages = (body.stages?.length ? body.stages : DEFAULT_STAGES).map((s, i) => ({
      title: (s.title || `Stage ${i + 1}`).trim(),
      percent: round2(Number(s.percent)),
      dueDate: s.dueDate || null,
      sortOrder: i,
    }));

    if (!inputStages.length) throw new BadRequestException('Add at least one payment stage');
    if (inputStages.some((s) => !s.title || !Number.isFinite(s.percent) || s.percent <= 0)) {
      throw new BadRequestException('Each stage needs a title and percent greater than 0');
    }

    const percentSum = round2(inputStages.reduce((a, s) => a + s.percent, 0));
    if (Math.abs(percentSum - 100) > 0.05) {
      throw new BadRequestException(`Stage percentages must add up to 100% (currently ${percentSum}%)`);
    }

    const locked = project.paymentStages.filter((s) => s.status === 'INVOICED' || s.status === 'PAID');
    if (locked.length) {
      throw new BadRequestException(
        'Cannot change the schedule after a stage invoice has been issued. Void unpaid stage invoices first, or create a new project.',
      );
    }

    // Split rupees so last stage absorbs rounding remainder.
    let allocated = 0;
    const amounts = inputStages.map((s, i) => {
      if (i === inputStages.length - 1) return round2(contractAmount - allocated);
      const amt = round2((contractAmount * s.percent) / 100);
      allocated = round2(allocated + amt);
      return amt;
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentStage.deleteMany({ where: { projectId, status: { in: ['PLANNED', 'VOID'] } } });
      await tx.project.update({
        where: { id: projectId },
        data: {
          contractAmount,
          currency: body.currency || project.currency || 'INR',
          taxPercent,
        },
      });
      await tx.paymentStage.createMany({
        data: inputStages.map((s, i) => ({
          projectId,
          title: s.title,
          percent: s.percent,
          amount: amounts[i],
          sortOrder: s.sortOrder,
          status: 'PLANNED' as const,
          dueDate: s.dueDate ? new Date(s.dueDate) : null,
        })),
      });
    });

    return this.get(projectId, { role: 'SUPER_ADMIN' } as AuthUser);
  }

  async issueStageInvoice(projectId: string, stageId: string, body?: { dueDate?: string; send?: boolean; notes?: string }) {
    const stage = await this.prisma.paymentStage.findFirst({
      where: { id: stageId, projectId },
      include: { project: true, invoice: true },
    });
    if (!stage) throw new NotFoundException('Payment stage not found');
    if (stage.status === 'PAID') throw new BadRequestException('This stage is already paid');
    if (stage.invoiceId && stage.status === 'INVOICED') {
      throw new BadRequestException('An invoice is already issued for this stage');
    }
    if (stage.project.contractAmount == null) {
      throw new BadRequestException('Set the payment schedule before issuing an invoice');
    }

    const amount = money(stage.amount);
    const taxPercent = money(stage.project.taxPercent ?? 18);
    const stageNo = stage.sortOrder + 1;
    const stageCount = await this.prisma.paymentStage.count({ where: { projectId } });
    const contract = money(stage.project.contractAmount);
    const dueDate =
      body?.dueDate ||
      (stage.dueDate ? stage.dueDate.toISOString().slice(0, 10) : new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));

    const invoice = await this.invoices.create({
      organizationId: stage.project.organizationId,
      type: 'TAX',
      currency: stage.project.currency || 'INR',
      dueDate,
      notes:
        body?.notes ||
        `Payment stage ${stageNo} of ${stageCount} for project "${stage.project.name}". Project total ₹${contract.toLocaleString('en-IN')}.`,
      lines: [
        {
          description: `${stage.title} (${money(stage.percent)}% of ₹${contract.toLocaleString('en-IN')}) — ${stage.project.name}`,
          quantity: 1,
          unitPrice: amount,
          taxPercent,
        },
      ],
      send: body?.send !== false,
      projectId,
    });

    await this.prisma.paymentStage.update({
      where: { id: stage.id },
      data: { invoiceId: invoice.id, status: 'INVOICED' },
    });

    await this.notifications.notifyOrganizationClients({
      organizationId: stage.project.organizationId,
      type: 'INVOICE_DUE',
      title: `Invoice for ${stage.title}`,
      body: `Please clear ${stage.percent}% (₹${amount.toLocaleString('en-IN')}) for ${stage.project.name}.`,
    }).catch(() => undefined);

    return { stageId: stage.id, invoice };
  }
}
