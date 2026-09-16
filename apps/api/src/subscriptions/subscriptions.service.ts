import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/current-user.decorator';
import { slugify } from '../common/utils';

@Injectable()
export class SubscriptionsService {
  constructor(private prisma: PrismaService) {}

  list(user: AuthUser, organizationId?: string) {
    const where: Prisma.ServiceSubscriptionWhereInput = {};
    if (user.role === 'CLIENT') where.organizationId = user.organizationId || '__none__';
    else if (organizationId) where.organizationId = organizationId;
    return this.prisma.serviceSubscription.findMany({
      where,
      include: {
        catalog: true,
        organization: { select: { id: true, name: true } },
        soldBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    }).then((rows) => rows.map((r) => this.serialize(r)));
  }

  async get(id: string, user: AuthUser) {
    const row = await this.prisma.serviceSubscription.findUnique({
      where: { id },
      include: { catalog: true, organization: true },
    });
    if (!row) throw new NotFoundException();
    if (user.role === 'CLIENT' && row.organizationId !== user.organizationId) {
      throw new NotFoundException();
    }
    return this.serialize(row);
  }

  private serialize(row: any) {
    return {
      ...row,
      customPrice: row.customPrice == null ? null : Number(row.customPrice),
      catalog: row.catalog
        ? {
            ...row.catalog,
            price: Number(row.catalog.price),
            taxPercent: Number(row.catalog.taxPercent),
          }
        : row.catalog,
    };
  }

  async create(data: any, user?: AuthUser) {
    const catalog = await this.resolveCatalog(data);
    const soldById = data.soldById || (user?.role === 'SALES' ? user.id : undefined);
    const sub = await this.prisma.serviceSubscription.create({
      data: {
        organizationId: data.organizationId,
        catalogId: catalog.id,
        status: data.status || 'ACTIVE',
        startDate: new Date(data.startDate),
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : null,
        slaNotes: data.slaNotes,
        customPrice: data.customPrice === '' || data.customPrice == null ? null : data.customPrice,
        notes: data.notes,
        soldById: soldById || null,
        soldAt: soldById ? new Date() : null,
      },
      include: {
        catalog: true,
        organization: { select: { id: true, name: true } },
        soldBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (soldById) {
      await this.prisma.organization.updateMany({
        where: { id: data.organizationId, salesPersonId: null },
        data: { salesPersonId: soldById },
      });
    }
    return this.serialize(sub);
  }

  private async resolveCatalog(data: any) {
    if (data.catalogId) {
      const existing = await this.prisma.serviceCatalog.findUnique({ where: { id: data.catalogId } });
      if (!existing) throw new BadRequestException('Service not found');
      return existing;
    }

    const name = String(data.serviceName || data.name || '').trim();
    if (!name) throw new BadRequestException('Enter a service name');

    const slug = slugify(name);
    const rows = await this.prisma.serviceCatalog.findMany({
      select: { id: true, name: true, slug: true },
    });
    const match = rows.find(
      (c) => c.name.toLowerCase() === name.toLowerCase() || (slug && c.slug === slug),
    );
    if (match) {
      return this.prisma.serviceCatalog.findUniqueOrThrow({ where: { id: match.id } });
    }

    let uniqueSlug = slug || `custom-${Date.now()}`;
    if (rows.some((c) => c.slug === uniqueSlug)) {
      uniqueSlug = `${uniqueSlug}-${Date.now().toString(36)}`;
    }

    return this.prisma.serviceCatalog.create({
      data: {
        name,
        slug: uniqueSlug,
        description: data.notes || null,
        category: 'Custom',
        sacCode: data.sacCode || null,
        price: data.customPrice === '' || data.customPrice == null ? 0 : data.customPrice,
        currency: data.currency || 'INR',
        taxPercent: 18,
        billingCycle: data.billingCycle || 'YEARLY',
        isPublished: false,
      },
    });
  }

  update(id: string, data: any) {
    return this.prisma.serviceSubscription.update({
      where: { id },
      data: {
        status: data.status,
        renewalDate: data.renewalDate ? new Date(data.renewalDate) : undefined,
        slaNotes: data.slaNotes,
        customPrice: data.customPrice,
        notes: data.notes,
      },
      include: { catalog: true },
    });
  }

  upcomingRenewals(days = 30) {
    const until = new Date();
    until.setDate(until.getDate() + days);
    return this.prisma.serviceSubscription.findMany({
      where: {
        status: 'ACTIVE',
        renewalDate: { lte: until, gte: new Date() },
      },
      include: { catalog: true, organization: true },
      orderBy: { renewalDate: 'asc' },
    });
  }
}
