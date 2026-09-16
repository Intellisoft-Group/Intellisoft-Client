import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthUser } from '../common/current-user.decorator';
import { settlementPayload } from '../common/bank-details';
import { invoiceStatusFromAmounts, money, nextNumber, resolveUploadPath, round2, splitGst } from '../common/utils';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InvoicesService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private mail: MailService,
    private notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, status?: string, organizationId?: string, type?: string) {
    await this.refreshOverdue();
    const where: Prisma.InvoiceWhereInput = {};
    if (user.role === 'CLIENT') {
      where.organizationId = user.organizationId || '__none__';
      where.status = { notIn: ['DRAFT', 'VOID'] };
    } else if (organizationId) {
      where.organizationId = organizationId;
    }
    if (type) where.type = type as InvoiceType;
    if (status && status !== 'ALL') {
      if (status === 'UNPAID') where.status = { in: ['SENT', 'PARTIAL', 'OVERDUE'] };
      else where.status = status as InvoiceStatus;
    }
    const rows = await this.prisma.invoice.findMany({
      where,
      include: { organization: { select: { id: true, name: true } }, lines: true },
      orderBy: { issueDate: 'desc' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async get(id: string, user: AuthUser) {
    let invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { organization: true, lines: true, payments: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (user.role === 'CLIENT') {
      if (invoice.organizationId !== user.organizationId || ['DRAFT', 'VOID'].includes(invoice.status)) {
        throw new NotFoundException('Invoice not found');
      }
      if (!invoice.payToken && ['SENT', 'PARTIAL', 'OVERDUE'].includes(invoice.status)) {
        const payToken = await this.ensurePayToken(id);
        invoice = { ...invoice, payToken };
      }
    }
    const serialized = this.serialize(invoice);
    // Always attach live CMS bank details so Clear Invoice / pay flows never use stale app defaults.
    const settlement = await this.settlementDetails();
    return { ...serialized, settlement };
  }

  /** Live bank / legal details from CMS Settings (no caching). */
  async settlementDetails() {
    const s = await this.prisma.appSettings.findUnique({ where: { id: 'default' } });
    return settlementPayload({
      companyName: s?.companyName,
      legalName: s?.legalName,
      bankName: s?.bankName,
      bankAccount: s?.bankAccount,
      bankIfsc: s?.bankIfsc,
      bankBranch: s?.bankBranch,
    });
  }

  async create(body: {
    organizationId: string;
    type?: InvoiceType;
    currency?: string;
    dueDate: string;
    notes?: string;
    projectId?: string;
    lines: {
      description: string;
      sacCode?: string;
      quantity: number;
      unitPrice: number;
      taxPercent: number;
    }[];
    send?: boolean;
  }) {
    if (!body.organizationId?.trim()) {
      throw new BadRequestException('Client (organization) is required');
    }
    if (!body.lines?.length) throw new BadRequestException('At least one line is required');

    const allowedTypes = new Set<string>(Object.values(InvoiceType));
    const type = (body.type || InvoiceType.TAX) as InvoiceType;
    if (!allowedTypes.has(type)) {
      throw new BadRequestException(`Invalid invoice type. Use one of: ${[...allowedTypes].join(', ')}`);
    }

    const dueDate = new Date(body.dueDate);
    if (!body.dueDate || Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException('A valid due date is required');
    }

    const org = await this.prisma.organization.findUnique({ where: { id: body.organizationId } });
    if (!org) throw new NotFoundException('Organization not found');
    const settings = await this.prisma.appSettings.findUnique({ where: { id: 'default' } });

    let subtotal = 0;
    let cgst = 0;
    let sgst = 0;
    let igst = 0;
    const computedLines = body.lines.map((line, index) => {
      const description = String(line.description || '').trim();
      if (!description) {
        throw new BadRequestException(`Line ${index + 1}: description is required`);
      }
      const qty = Number(line.quantity);
      const unit = Number(line.unitPrice);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new BadRequestException(`Line ${index + 1}: quantity must be a positive number`);
      }
      if (!Number.isFinite(unit) || unit < 0) {
        throw new BadRequestException(`Line ${index + 1}: unit price must be a valid number`);
      }
      const amount = round2(qty * unit);
      subtotal = round2(subtotal + amount);
      const taxOn = settings?.chargesTax === true;
      const rawTax = Number(line.taxPercent);
      const lineTax = taxOn
        ? (Number.isFinite(rawTax) && String(line.taxPercent ?? '').trim() !== ''
            ? rawTax
            : Number(settings?.defaultTaxPercent ?? 0))
        : 0;
      if (!Number.isFinite(lineTax) || lineTax < 0) {
        throw new BadRequestException(`Line ${index + 1}: tax percent is invalid`);
      }
      const split = splitGst(
        amount,
        lineTax,
        settings?.state || 'Karnataka',
        org.placeOfSupply || org.state || '',
      );
      cgst = round2(cgst + split.cgst);
      sgst = round2(sgst + split.sgst);
      igst = round2(igst + split.igst);
      return {
        description,
        sacCode: line.sacCode || null,
        quantity: qty,
        unitPrice: unit,
        taxPercent: lineTax,
        amount,
      };
    });

    const total = round2(subtotal + cgst + sgst + igst);
    const number = await this.allocateInvoiceNumber();

    let invoice;
    try {
      invoice = await this.prisma.invoice.create({
        data: {
          number,
          type,
          status: 'DRAFT',
          organizationId: body.organizationId,
          projectId: body.projectId || null,
          currency: body.currency || 'INR',
          subtotal,
          cgst,
          sgst,
          igst,
          total,
          amountPaid: 0,
          amountDue: total,
          dueDate,
          notes: body.notes,
          lines: { create: computedLines },
        },
        include: { organization: true, lines: true },
      });
    } catch (e: any) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        // Rare race on invoice number — retry once with a fresh sequence.
        const retryNumber = await this.allocateInvoiceNumber();
        invoice = await this.prisma.invoice.create({
          data: {
            number: retryNumber,
            type,
            status: 'DRAFT',
            organizationId: body.organizationId,
            projectId: body.projectId || null,
            currency: body.currency || 'INR',
            subtotal,
            cgst,
            sgst,
            igst,
            total,
            amountPaid: 0,
            amountDue: total,
            dueDate,
            notes: body.notes,
            lines: { create: computedLines },
          },
          include: { organization: true, lines: true },
        });
      } else if (e instanceof Prisma.PrismaClientKnownRequestError) {
        throw new BadRequestException(e.message || 'Could not create invoice');
      } else {
        throw e;
      }
    }

    // Manual invoice PDFs are uploaded after the invoice is marked Paid.
    if (body.send !== false) {
      try {
        return await this.send(invoice.id);
      } catch (e: any) {
        // Invoice already exists — return it rather than failing the whole create.
        return this.get(invoice.id, { role: 'SUPER_ADMIN' } as AuthUser);
      }
    }
    return this.get(invoice.id, { role: 'SUPER_ADMIN' } as AuthUser);
  }

  /** Next INV-YYYY-#### using max existing sequence (safe after voids/deletes). */
  private async allocateInvoiceNumber() {
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const latest = await this.prisma.invoice.findFirst({
      where: { number: { startsWith: prefix } },
      orderBy: { number: 'desc' },
      select: { number: true },
    });
    let seq = 1;
    if (latest?.number?.startsWith(prefix)) {
      const parsed = parseInt(latest.number.slice(prefix.length), 10);
      if (Number.isFinite(parsed) && parsed >= 0) seq = parsed + 1;
    }
    return nextNumber('INV', seq, year);
  }

  payUrl(token: string) {
    const apiUrl = (this.config.get('API_PUBLIC_URL') || 'http://localhost:3000').replace(/\/$/, '');
    return `${apiUrl}/pay/${token}`;
  }

  async ensurePayToken(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.payToken) return invoice.payToken;
    const payToken = crypto.randomBytes(16).toString('hex');
    await this.prisma.invoice.update({ where: { id }, data: { payToken } });
    return payToken;
  }

  async share(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === 'VOID') throw new BadRequestException('Cannot share a void invoice');
    if (invoice.status === 'DRAFT') return this.send(id);
    await this.ensurePayToken(id);
    return this.get(id, { role: 'SUPER_ADMIN' } as AuthUser);
  }

  async send(id: string) {
    const current = await this.prisma.invoice.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Invoice not found');
    if (current.status === 'VOID') throw new BadRequestException('Cannot send a void invoice');
    const payToken = current.payToken || crypto.randomBytes(16).toString('hex');
    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: { status: current.status === 'DRAFT' ? 'SENT' : current.status, payToken },
      include: { organization: true },
    });
    const link = this.payUrl(payToken);
    const kind = invoice.type === 'PROFORMA' ? 'quote' : 'invoice';
    const body = `A new ${kind} of ${invoice.currency} ${money(invoice.total)} is due on ${invoice.dueDate.toDateString()}.`;
    try {
      await this.notifications.notifyOrganizationClients({
        organizationId: invoice.organizationId,
        type: 'INVOICE_DUE',
        title: invoice.type === 'PROFORMA' ? `Quote ${invoice.number}` : `Invoice ${invoice.number}`,
        body,
      });
    } catch {
      // Push/inbox failure must not block invoice send.
    }
    await this.mail.send(
      invoice.organization.email,
      `${invoice.type === 'PROFORMA' ? 'Quote' : 'Invoice'} ${invoice.number} from Intellisoft`,
      this.mail.wrap(
        `${invoice.type === 'PROFORMA' ? 'Quote' : 'Invoice'} ${invoice.number}`,
        `<p>${body}</p>
         <p>Pay online with this link (no login required):</p>
         <p><a href="${link}" style="display:inline-block;background:#0D9488;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Open ${kind}</a></p>
         <p style="word-break:break-all">${link}</p>
         <p>After payment, the paid invoice appears in the Intellisoft client app.</p>`,
      ),
    );
    return this.get(id, { role: 'SUPER_ADMIN' } as AuthUser);
  }

  async void(id: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException();
    if (money(invoice.amountPaid) > 0) {
      throw new BadRequestException('Cannot void an invoice with payments');
    }
    const updated = await this.prisma.invoice.update({ where: { id }, data: { status: 'VOID' } });
    try {
      await this.prisma.paymentStage.updateMany({
        where: { invoiceId: id },
        data: { status: 'PLANNED', invoiceId: null },
      });
    } catch {
      /* PaymentStage table may be missing until migrate deploy */
    }
    return updated;
  }

  async applyPayment(invoiceId: string, amount: number) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException();
    if (invoice.status === 'VOID' || invoice.status === 'DRAFT') {
      throw new BadRequestException('Cannot apply payment to this invoice');
    }
    if (invoice.status === 'PAID' && money(invoice.amountDue) <= 0) {
      throw new BadRequestException('Invoice is already paid');
    }
    const due = money(invoice.amountDue);
    if (amount > due + 0.009) {
      throw new BadRequestException(`Amount exceeds balance due (${due})`);
    }
    const amountPaid = round2(money(invoice.amountPaid) + amount);
    const amountDue = round2(Math.max(0, money(invoice.total) - amountPaid));
    // DRAFT / VOID already rejected above — remaining statuses can move via amounts.
    const status = invoiceStatusFromAmounts(amountDue, amountPaid, invoice.dueDate) as InvoiceStatus;
    const updated = await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: { amountPaid, amountDue, status },
    });
    if (status === 'PAID') {
      try {
        await this.prisma.paymentStage.updateMany({
          where: { invoiceId },
          data: { status: 'PAID' },
        });
      } catch {
        /* PaymentStage table may be missing until migrate deploy */
      }
    }
    return updated;
  }

  /** Staff-uploaded invoice PDF — only after the invoice is Paid. */
  async uploadPdf(id: string, file: Express.Multer.File) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status !== 'PAID') {
      throw new BadRequestException('Mark the invoice Paid before uploading the invoice PDF');
    }
    if (!file) throw new BadRequestException('A PDF file is required');
    const mime = (file.mimetype || '').toLowerCase();
    if (mime && mime !== 'application/pdf' && !file.originalname?.toLowerCase().endsWith('.pdf')) {
      throw new BadRequestException('Only PDF files are accepted');
    }
    const relative = `uploads/invoices/${file.filename}`.replace(/\\/g, '/');
    if (invoice.pdfPath && invoice.pdfPath !== relative) {
      const prev = resolveUploadPath(invoice.pdfPath);
      if (prev) {
        try {
          fs.unlinkSync(prev);
        } catch {
          /* ignore stale file cleanup */
        }
      }
    }
    await this.prisma.invoice.update({ where: { id }, data: { pdfPath: relative } });
    return this.get(id, { role: 'SUPER_ADMIN' } as AuthUser);
  }

  async resolvePdfFile(id: string, user: AuthUser) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    await this.assertCanView(invoice, user);
    if (invoice.status !== 'PAID' || !this.hasUploadedPdf(invoice)) {
      throw new NotFoundException('Invoice PDF is not available yet');
    }
    const full = resolveUploadPath(invoice.pdfPath);
    if (!full) throw new NotFoundException('Invoice PDF file missing');
    return {
      full,
      fileName: `${invoice.number}.pdf`,
    };
  }

  private assertCanView(
    invoice: { organizationId: string; status: InvoiceStatus },
    user: AuthUser,
  ) {
    if (user.role === 'CLIENT' && invoice.organizationId !== user.organizationId) {
      throw new ForbiddenException();
    }
    if (user.role === 'CLIENT' && ['DRAFT', 'VOID'].includes(invoice.status)) {
      throw new ForbiddenException();
    }
  }


  serialize(invoice: any) {
    const { payToken, ...rest } = invoice;
    return {
      ...rest,
      subtotal: money(invoice.subtotal),
      cgst: money(invoice.cgst),
      sgst: money(invoice.sgst),
      igst: money(invoice.igst),
      total: money(invoice.total),
      amountPaid: money(invoice.amountPaid),
      amountDue: money(invoice.amountDue),
      ...this.clientPdfMeta(invoice),
      payUrl: payToken ? this.payUrl(payToken) : null,
      lines: invoice.lines?.map((l: any) => ({
        ...l,
        quantity: money(l.quantity),
        unitPrice: money(l.unitPrice),
        taxPercent: money(l.taxPercent),
        amount: money(l.amount),
      })),
      payments: invoice.payments?.map((p: any) => ({
        ...p,
        amount: money(p.amount),
      })),
    };
  }

  /** Client download is only for staff-uploaded PDFs on Paid invoices. */
  hasUploadedPdf(invoice: { status?: string; pdfPath?: string | null }) {
    return invoice.status === 'PAID' && !!invoice.pdfPath;
  }

  /** Shared by project stage payloads so each paid stage can expose its own PDF. */
  clientPdfMeta(invoice: { id?: string; status?: string; pdfPath?: string | null }) {
    const apiUrl = (this.config.get('API_PUBLIC_URL') || 'http://localhost:3000').replace(/\/$/, '');
    const hasPdf = this.hasUploadedPdf(invoice);
    return {
      hasPdf,
      pdfUrl: hasPdf && invoice.id ? `${apiUrl}/invoices/${invoice.id}/pdf` : null,
    };
  }

  private async refreshOverdue() {
    await this.prisma.invoice.updateMany({
      where: {
        status: { in: ['SENT', 'PARTIAL'] },
        dueDate: { lt: new Date() },
        amountDue: { gt: 0 },
      },
      data: { status: 'OVERDUE' },
    });
  }

  assertCanPay(invoice: { status: InvoiceStatus; amountDue: any; organizationId: string }, user: AuthUser) {
    if (user.role === 'CLIENT' && invoice.organizationId !== user.organizationId) {
      throw new ForbiddenException();
    }
    if (['VOID', 'PAID', 'DRAFT'].includes(invoice.status)) {
      throw new BadRequestException('Invoice cannot be paid');
    }
    if (money(invoice.amountDue) <= 0) throw new BadRequestException('Nothing due');
  }
}
