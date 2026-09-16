import { Controller, Get, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Response } from 'express';
import { Public } from './common/roles.decorator';
import { PrismaService } from './prisma/prisma.service';

@SkipThrottle()
@Controller()
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Public()
  @Get('health')
  health() {
    const payload: { ok: boolean; service: string; env?: string } = {
      ok: true,
      service: 'intellisoft-api',
    };
    if (process.env.NODE_ENV !== 'production') {
      payload.env = process.env.NODE_ENV || 'development';
    }
    return payload;
  }

  @Public()
  @Get('ready')
  async ready(@Res({ passthrough: true }) res: Response) {
    await this.prisma.$queryRaw`SELECT 1`;

    const probe = async (sql: TemplateStringsArray) => {
      try {
        await this.prisma.$queryRaw(sql);
        return true;
      } catch {
        return false;
      }
    };

    const notificationRefId = await probe`SELECT "refId" FROM "Notification" LIMIT 1`;
    const chargesTax = await probe`SELECT "chargesTax" FROM "AppSettings" LIMIT 1`;
    const projectTaxPercent = await probe`SELECT "taxPercent" FROM "Project" LIMIT 1`;
    const invoiceProjectId = await probe`SELECT "projectId" FROM "Invoice" LIMIT 1`;
    const paymentStage = await probe`SELECT "id" FROM "PaymentStage" LIMIT 1`;

    const ok =
      notificationRefId && chargesTax && projectTaxPercent && invoiceProjectId && paymentStage;
    if (!ok) res.status(503);
    return {
      ok,
      schema: {
        notificationRefId,
        chargesTax,
        projectTaxPercent,
        invoiceProjectId,
        paymentStage,
      },
    };
  }
}
