import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { money, slugify } from '../common/utils';
import { AuthUser } from '../common/current-user.decorator';

const EXTRA_OFFERINGS = [
  {
    slug: 'it-consulting-discovery',
    name: 'IT Consulting & Discovery',
    category: 'Consulting',
    sacCode: '998314',
    price: 75000,
    billingCycle: 'ONE_TIME' as const,
    description: 'Workshops, current-state assessment and a written roadmap for systems, process and security.',
    features: ['Discovery workshop', 'Architecture review', 'Prioritised roadmap'],
  },
  {
    slug: 'cybersecurity-vapt',
    name: 'Cybersecurity & VAPT',
    category: 'Security',
    sacCode: '998319',
    price: 120000,
    billingCycle: 'ONE_TIME' as const,
    description: 'Vulnerability assessment, penetration testing and a remediation plan for your applications and network.',
    features: ['External & internal VAPT', 'Risk-ranked findings', 'Retest window'],
  },
  {
    slug: 'erp-crm-implementation',
    name: 'ERP / CRM Implementation',
    category: 'Implementation',
    sacCode: '998314',
    price: 450000,
    billingCycle: 'ONE_TIME' as const,
    description: 'Configure, migrate and go-live for ERP or CRM with training for your team.',
    features: ['Process mapping', 'Data migration', 'Go-live support'],
  },
  {
    slug: 'resource-augmentation',
    name: 'Resource Augmentation',
    category: 'Staffing',
    sacCode: '998313',
    price: 80000,
    billingCycle: 'MONTHLY' as const,
    description: 'Dedicated developers, analysts or support engineers embedded with your team.',
    features: ['Named engineer', 'Monthly reporting', 'Flexible ramp-up'],
  },
  {
    slug: 'managed-it-support',
    name: 'Managed IT Support Desk',
    category: 'Support',
    sacCode: '998313',
    price: 35000,
    billingCycle: 'MONTHLY' as const,
    description: 'Helpdesk, device and user support with agreed response times.',
    features: ['Shared helpdesk', 'Remote support', 'Monthly SLA report'],
  },
  {
    slug: 'data-analytics-bi',
    name: 'Data Analytics & BI',
    category: 'Analytics',
    sacCode: '998314',
    price: 180000,
    billingCycle: 'ONE_TIME' as const,
    description: 'Dashboards, data models and reporting so leadership can see the business clearly.',
    features: ['KPI workshop', 'Dashboard build', 'Handover training'],
  },
  {
    slug: 'mobile-app-development',
    name: 'Mobile App Development',
    category: 'Development',
    sacCode: '998314',
    price: 350000,
    billingCycle: 'ONE_TIME' as const,
    description: 'Design and build of iOS / Android or Flutter apps, including store submission.',
    features: ['UX design', 'Native or Flutter build', 'Store release'],
  },
  {
    slug: 'it-training-enablement',
    name: 'IT Training & Enablement',
    category: 'Training',
    sacCode: '999293',
    price: 45000,
    billingCycle: 'ONE_TIME' as const,
    description: 'Hands-on training for Microsoft 365, security hygiene or the systems we implement.',
    features: ['Half or full day', 'Practical labs', 'Leave-behind notes'],
  },
];

@Injectable()
export class CatalogService implements OnModuleInit {
  private readonly log = new Logger(CatalogService.name);
  constructor(private prisma: PrismaService) {}

  async onModuleInit() {
    try {
      await this.ensureOfferings();
    } catch (e: any) {
      this.log.warn(`Catalog seed skipped: ${e?.message || e}`);
    }
  }

  /** Ensure core Intellisoft offerings exist (create missing only — fast boot). */
  async ensureOfferings() {
    for (const item of EXTRA_OFFERINGS) {
      const existing = await this.prisma.serviceCatalog.findUnique({ where: { slug: item.slug } });
      if (existing) {
        if (!existing.isPublished) {
          await this.prisma.serviceCatalog.update({
            where: { id: existing.id },
            data: { isPublished: true },
          });
        }
        continue;
      }
      await this.prisma.serviceCatalog.create({
        data: {
          ...item,
          currency: 'INR',
          taxPercent: 18,
          isPublished: true,
        },
      });
    }
    this.log.log('Service catalog offerings ready for clients');
  }

  async list(user: AuthUser, publishedOnly = false) {
    const where: Prisma.ServiceCatalogWhereInput = {};
    if (user.role === 'CLIENT' || publishedOnly) where.isPublished = true;
    const rows = await this.prisma.serviceCatalog.findMany({
      where,
      orderBy: { name: 'asc' },
    });
    return rows.map((r) => this.serialize(r));
  }

  async get(id: string, user?: AuthUser) {
    const row = await this.prisma.serviceCatalog.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Service not found');
    if (user?.role === 'CLIENT' && !row.isPublished) {
      throw new NotFoundException('Service not found');
    }
    return this.serialize(row);
  }

  private serialize(row: any) {
    const description = row.description || '';
    return {
      ...row,
      price: money(row.price),
      taxPercent: money(row.taxPercent),
      // Client apps historically read "summary"; keep both for compatibility.
      summary: description,
      description,
    };
  }

  async create(data: any) {
    const settings = await this.prisma.appSettings.findUnique({ where: { id: 'default' } });
    const taxOn = settings?.chargesTax === true;
    const defaultTax = taxOn ? Number(settings?.defaultTaxPercent ?? 0) : 0;
    return this.serialize(
      await this.prisma.serviceCatalog.create({
        data: {
          name: data.name,
          slug: data.slug || slugify(data.name),
          description: data.description,
          category: data.category,
          sacCode: data.sacCode,
          price: data.price,
          currency: data.currency || 'INR',
          taxPercent: data.taxPercent != null ? data.taxPercent : defaultTax,
          billingCycle: data.billingCycle || 'YEARLY',
          isPublished: data.isPublished ?? true,
          features: data.features ?? undefined,
        },
      }),
    );
  }

  async update(id: string, data: any) {
    return this.serialize(
      await this.prisma.serviceCatalog.update({
        where: { id },
        data: {
          name: data.name,
          slug: data.slug,
          description: data.description,
          category: data.category,
          sacCode: data.sacCode,
          price: data.price,
          currency: data.currency,
          taxPercent: data.taxPercent,
          billingCycle: data.billingCycle,
          isPublished: data.isPublished,
          features: data.features,
        },
      }),
    );
  }
}
