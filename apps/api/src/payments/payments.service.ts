import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { AuthUser } from '../common/current-user.decorator';
import { buildBankDetailRows } from '../common/bank-details';
import { money, round2 } from '../common/utils';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private invoices: InvoicesService,
    private notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, organizationId?: string) {
    const where: Prisma.PaymentWhereInput = {};
    if (user.role === 'CLIENT') where.organizationId = user.organizationId || '__none__';
    else if (organizationId) where.organizationId = organizationId;
    const rows = await this.prisma.payment.findMany({
      where,
      include: {
        invoice: { select: { id: true, number: true } },
        organization: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => ({ ...p, amount: money(p.amount) }));
  }

  async get(id: string, user: AuthUser) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: { invoice: true, organization: true },
    });
    if (!payment) throw new NotFoundException();
    if (user.role === 'CLIENT' && payment.organizationId !== user.organizationId) {
      throw new NotFoundException();
    }
    return { ...payment, amount: money(payment.amount) };
  }

  /** Online card gateways removed — clients clear invoices by bank transfer. */
  async startPay(_invoiceId: string, _user: AuthUser, _amount?: number) {
    throw new BadRequestException(
      'Online card payment is not available. Please clear the invoice by bank transfer and share the UTR with Intellisoft.',
    );
  }

  async markOffline(
    invoiceId: string,
    body: { amount?: number; gateway: 'BANK' | 'CASH' | 'CHEQUE'; utr?: string; notes?: string },
  ) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new NotFoundException();
    if (invoice.status === 'VOID' || invoice.status === 'DRAFT') {
      throw new BadRequestException('Cannot record payment on this invoice');
    }
    if (invoice.status === 'PAID' || money(invoice.amountDue) <= 0) {
      throw new BadRequestException('Invoice is already paid');
    }
    const amount = round2(body.amount && body.amount > 0 ? body.amount : money(invoice.amountDue));
    if (!(amount > 0)) throw new BadRequestException('Payment amount must be greater than zero');
    if (amount > money(invoice.amountDue) + 0.009) {
      throw new BadRequestException(`Amount exceeds balance due (${money(invoice.amountDue)})`);
    }
    const payment = await this.prisma.payment.create({
      data: {
        invoiceId,
        organizationId: invoice.organizationId,
        gateway: body.gateway,
        status: 'SUCCEEDED',
        amount,
        currency: invoice.currency,
        utr: body.utr,
        notes: body.notes,
        paidAt: new Date(),
      },
    });
    await this.invoices.applyPayment(invoiceId, amount);
    await this.notifyPaid(invoice.organizationId, invoiceId, amount, invoice.currency);
    return { ...payment, amount };
  }

  async cancel(paymentId: string, user?: AuthUser) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException();
    if (user?.role === 'CLIENT' && payment.organizationId !== user.organizationId) {
      throw new ForbiddenException();
    }
    if (payment.status === 'SUCCEEDED') {
      return { ...payment, amount: money(payment.amount) };
    }
    const updated = await this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: 'FAILED', notes: payment.notes || 'Cancelled' },
    });
    return { ...updated, amount: money(updated.amount) };
  }

  async invoiceByPayToken(token: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { payToken: token },
      include: { organization: true, lines: true },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async publicPayHtml(token: string) {
    const invoice = await this.invoiceByPayToken(token);
    const settings = await this.prisma.appSettings.findUnique({ where: { id: 'default' } });
    const company = (settings?.companyName || 'Intellisoft').trim() || 'Intellisoft';
    const legalName = (settings?.legalName || '').trim() || company;
    const paid = invoice.status === 'PAID' || money(invoice.amountDue) <= 0;
    const esc = (value: string) =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
    const amount = paid ? money(invoice.total) : money(invoice.amountDue);
    const lines = invoice.lines
      .map(
        (line) =>
          `<div style="display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid #EEF1F6">
            <span>${esc(line.description)}</span>
            <span>${esc(invoice.currency)} ${money(line.amount).toFixed(2)}</span>
          </div>`,
      )
      .join('');
    const bankRows = buildBankDetailRows({
      companyName: settings?.companyName,
      legalName,
      bankName: settings?.bankName,
      bankAccount: settings?.bankAccount,
      bankIfsc: settings?.bankIfsc,
      bankBranch: settings?.bankBranch,
    })
      .map(
        ({ label, value }) =>
          `<div style="display:flex;justify-content:space-between;gap:12px;padding:10px 0;border-bottom:1px solid #EEF1F6">
            <span class="muted">${esc(label)}</span>
            <strong style="text-align:right">${esc(value)}</strong>
          </div>`,
      )
      .join('');
    return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${paid ? 'Paid' : 'Clear'} ${esc(invoice.number)}</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#F3F5F8;color:#0A1628}
  .wrap{max-width:440px;margin:0 auto;padding:24px 16px}
  .hero{background:#000;color:#fff;border-radius:18px;padding:24px;text-align:center}
  .card{background:#fff;border-radius:16px;padding:18px;margin-top:14px}
  .note{background:#E8EEF8;border-radius:14px;padding:14px;margin-top:14px;font-size:13px;line-height:1.5}
  .warn{background:#FFF8E8;border-radius:14px;padding:14px;margin-top:14px;font-size:13px;line-height:1.5}
  .muted{color:#5B6B7C;font-size:13px}
</style></head>
<body>
<div class="wrap">
  <div class="hero">
    <div style="font-size:24px;font-weight:800">${esc(company)}</div>
    <p class="muted" style="color:rgba(255,255,255,.7);margin:8px 0 0">Invoice settlement</p>
  </div>
  <div class="card">
    <p class="muted" style="margin:0">${paid ? 'PAID IN FULL' : 'AMOUNT DUE'}</p>
    <p style="margin:6px 0 0;font-size:32px;font-weight:800">${esc(invoice.currency)} ${amount.toFixed(2)}</p>
    <p style="margin:10px 0 0;font-weight:600">${esc(invoice.number)}</p>
    <p class="muted" style="margin:4px 0 0">${esc(invoice.organization.name)} · Due ${invoice.dueDate.toISOString().slice(0, 10)}</p>
  </div>
  <div class="card">${lines || '<p class="muted">No line items</p>'}</div>
  <div class="note">
    <strong>Settlement</strong><br>
    Collections for ${esc(company)} are received in the account of ${esc(legalName)}. Funds are reconciled and this invoice is updated to Paid when credit is confirmed.
  </div>
  ${
    paid
      ? `<p style="margin-top:24px" class="muted">This invoice is paid.</p>`
      : `<div class="card"><strong>Bank account details</strong>${bankRows}</div>
         <div class="warn">
           <strong>Payment reference</strong><br>
           Use invoice number <strong>${esc(invoice.number)}</strong> as the transfer reference. Share the UTR with your ${esc(company)} contact after remittance.
         </div>
         <p class="muted" style="margin-top:16px;text-align:center;font-size:11px">${esc(legalName)} · ${esc(company)}</p>`
  }
</div></body></html>`;
  }

  private async notifyPaid(organizationId: string, invoiceId: string, amount: number, currency: string) {
    const invoice = await this.prisma.invoice.findUnique({ where: { id: invoiceId } });
    await this.notifications
      .notifyOrganizationClients({
        organizationId,
        type: 'PAYMENT_SUCCESS',
        title: 'Payment received',
        body: `${currency} ${amount.toFixed(2)} received for invoice ${invoice?.number || ''}.`,
        refId: invoiceId,
      })
      .catch(() => undefined);
  }
}
