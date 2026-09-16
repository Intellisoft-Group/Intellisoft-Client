import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { settlementPayload } from '../common/bank-details';
import { toPublicSettings } from '../common/public-settings';

function serializeSettings<T extends Record<string, any>>(row: T) {
  return {
    ...row,
    defaultTaxPercent: Number(row.defaultTaxPercent ?? 18),
  };
}

@Injectable()
export class SettingsService {
  private readonly log = new Logger(SettingsService.name);

  constructor(private prisma: PrismaService) {}

  async ensureDefault() {
    const existing = await this.prisma.appSettings.findUnique({ where: { id: 'default' } });
    if (existing) return serializeSettings(existing);
    try {
      const created = await this.prisma.appSettings.create({
        data: {
          id: 'default',
          companyName: 'Intellisoft',
          legalName: 'Intellisoft',
          state: 'Karnataka',
          country: 'India',
        },
      });
      return serializeSettings(created);
    } catch (e: any) {
      // Race: another request created the row first
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        const again = await this.prisma.appSettings.findUnique({ where: { id: 'default' } });
        if (again) return serializeSettings(again);
      }
      this.log.error(`AppSettings ensureDefault failed: ${e?.message || e}`);
      throw e;
    }
  }

  get() {
    return this.ensureDefault();
  }

  async getPublic() {
    return toPublicSettings(await this.get());
  }

  /** Bank details for signed-in clients / staff (not on /settings/public). */
  async getPaymentDetails() {
    const s = await this.get();
    return settlementPayload({
      companyName: s.companyName,
      legalName: s.legalName,
      bankName: s.bankName,
      bankAccount: s.bankAccount,
      bankIfsc: s.bankIfsc,
      bankBranch: s.bankBranch,
    });
  }

  async update(data: any) {
    await this.ensureDefault();
    // Nullable DB columns may be cleared with null; required String fields must stay strings.
    const opt = (v: unknown) => (v == null ? null : String(v).trim() || null);
    const req = (v: unknown, fallback: string) => {
      const s = v == null ? '' : String(v).trim();
      return s || fallback;
    };
    const updated = await this.prisma.appSettings.update({
      where: { id: 'default' },
      data: {
        companyName: req(data.companyName, 'Intellisoft'),
        legalName: req(data.legalName, 'Intellisoft'),
        gstin: opt(data.gstin),
        pan: opt(data.pan),
        email: opt(data.email),
        phone: opt(data.phone),
        address: opt(data.address),
        city: opt(data.city),
        state: req(data.state, 'Karnataka'),
        pincode: opt(data.pincode),
        country: req(data.country, 'India'),
        bankName: opt(data.bankName),
        bankAccount: opt(data.bankAccount),
        bankIfsc: opt(data.bankIfsc),
        bankBranch: opt(data.bankBranch),
        logoUrl: opt(data.logoUrl),
        primaryColor: req(data.primaryColor, '#0D9488'),
        splashCopy: req(data.splashCopy, 'Services, invoices and payments'),
        maintenanceMode: !!data.maintenanceMode,
        minAppVersion: req(data.minAppVersion, '1.0.0'),
        chargesTax: !!data.chargesTax,
        defaultTaxPercent: Number(data.defaultTaxPercent ?? 18),
      },
    });
    return serializeSettings(updated);
  }
}
