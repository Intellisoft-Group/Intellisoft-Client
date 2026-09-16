import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly log = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (!host) return;
    this.transporter = nodemailer.createTransport({
      host,
      port: Number(this.config.get('SMTP_PORT') || 587),
      secure: this.config.get('SMTP_SECURE') === 'true',
      auth: this.config.get('SMTP_USER')
        ? { user: this.config.get('SMTP_USER'), pass: this.config.get('SMTP_PASS') }
        : undefined,
    });
  }

  async send(to: string | null | undefined, subject: string, html: string) {
    if (!to) return;
    const from = this.config.get('SMTP_FROM') || 'Intellisoft <chief@theintellisoft.com>';
    if (!this.transporter) {
      this.log.warn(`SMTP not set; skipped "${subject}" to ${to}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from, to, subject, html });
    } catch (err) {
      this.log.error(`Email failed: ${subject} → ${to}`, err as Error);
    }
  }

  wrap(title: string, body: string) {
    const api = String(this.config.get('API_PUBLIC_URL') || 'http://localhost:3000').replace(/\/$/, '');
    const logo = `${api}/uploads/brand/logo.png`;
    return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0c1b2e">
      <div style="background:#0c1b2e;color:#fff;padding:18px 22px;border-radius:8px 8px 0 0">
        <img src="${logo}" alt="Intellisoft" height="36" style="height:36px;width:auto;display:block;border:0;border-radius:4px" />
      </div>
      <div style="border:1px solid #d5dce5;border-top:0;padding:22px;border-radius:0 0 8px 8px">
        <h2 style="margin:0 0 12px;font-size:20px">${title}</h2>
        ${body}
        <p style="color:#5a6a7b;font-size:13px;margin-top:24px">This message was sent from the Intellisoft operations platform.</p>
      </div>
    </div>`;
  }
}
