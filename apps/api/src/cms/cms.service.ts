import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthUser } from '../common/current-user.decorator';
import { toPublicSettings } from '../common/public-settings';

const CORPORATE_FAQS: { question: string; answer: string }[] = [
  {
    question: 'Who is Intellisoft?',
    answer:
      'Intellisoft is an IT services company that designs, builds, hosts, and supports digital products for businesses. We partner with clients as a long-term technology team—not a one-time vendor.',
  },
  {
    question: 'What services does Intellisoft provide?',
    answer:
      'We deliver software development, websites and web apps, cloud and hosting, IT support, AMC, and related digital services. Each engagement is scoped to your business goals, timeline, and budget.',
  },
  {
    question: 'Do you serve clients online across the globe?',
    answer:
      'Yes. Intellisoft works with clients online and delivers services remotely, so we can support businesses in India and across the world. Communication, delivery reviews, billing, and support all run through secure digital channels—including this client app and portal.',
  },
  {
    question: 'How does an engagement with Intellisoft typically work?',
    answer:
      'We begin with your requirements, agree the scope and commercial terms, then deliver in clear stages. You can track projects, invoices, files, and support updates in the Intellisoft client app throughout the engagement.',
  },
  {
    question: 'How do I pay an invoice?',
    answer:
      'Open Bills, select the invoice, and choose Clear invoice. Transfer the amount using the bank details shown and include the invoice number as the payment reference. After we confirm receipt, the invoice is marked Paid.',
  },
  {
    question: 'How do I get support for a live service or project?',
    answer:
      'Use the Support section in the app to raise a ticket. Describe the issue clearly and attach details where helpful. Our team responds in-app so you have a full record of the conversation.',
  },
  {
    question: 'Where can I track project progress and share files?',
    answer:
      'Open Projects to view milestones, payment stages, chat, and project files. You can upload logos, briefs, contracts, and delivery assets so both teams work from the same source of truth.',
  },
  {
    question: 'Can I download invoice PDFs?',
    answer:
      'Yes. When an invoice PDF is available, a download option appears on that invoice in Bills. If a PDF is still pending, our finance team will upload it after the document is ready.',
  },
  {
    question: 'How is my business information protected?',
    answer:
      'Access to the client app is limited to authorised accounts for your organisation. Files, invoices, and support history are handled through Intellisoft systems under your service agreement and our operational security practices.',
  },
  {
    question: 'How do I start a new project or request additional services?',
    answer:
      'Contact your Intellisoft account manager, or use in-app chat / Support to share your requirement. Our team will confirm scope, commercial terms, and next steps before work begins.',
  },
];

@Injectable()
export class CmsService implements OnModuleInit {
  private readonly log = new Logger(CmsService.name);

  constructor(private prisma: PrismaService, private mail: MailService) {}

  async onModuleInit() {
    try {
      await this.ensureCorporateFaqs();
    } catch (e: any) {
      this.log.warn(`FAQ seed skipped: ${e?.message || e}`);
    }
  }

  /** Insert missing corporate FAQs without overwriting CMS edits to existing questions. */
  async ensureCorporateFaqs() {
    for (let i = 0; i < CORPORATE_FAQS.length; i++) {
      const item = CORPORATE_FAQS[i];
      const existing = await this.prisma.faq.findFirst({ where: { question: item.question } });
      if (existing) continue;
      await this.prisma.faq.create({
        data: {
          question: item.question,
          answer: item.answer,
          sortOrder: i,
          isActive: true,
        },
      });
    }
    this.log.log('Corporate FAQs available for clients');
  }

  async bootstrap() {
    const [settings, banners, announcements, faqs, pages] = await Promise.all([
      this.prisma.appSettings.findUnique({ where: { id: 'default' } }),
      this.prisma.appBanner.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.announcement.findMany({ where: { isActive: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.faq.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
      this.prisma.cmsPage.findMany(),
    ]);
    return { settings: toPublicSettings(settings), banners, announcements, faqs, pages };
  }

  banners() {
    return this.prisma.appBanner.findMany({ orderBy: { sortOrder: 'asc' } });
  }
  createBanner(data: any) {
    return this.prisma.appBanner.create({ data });
  }
  updateBanner(id: string, data: any) {
    return this.prisma.appBanner.update({ where: { id }, data });
  }
  deleteBanner(id: string) {
    return this.prisma.appBanner.delete({ where: { id } });
  }

  announcements() {
    return this.prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  }
  createAnnouncement(data: any) {
    return this.prisma.announcement.create({ data });
  }
  updateAnnouncement(id: string, data: any) {
    return this.prisma.announcement.update({ where: { id }, data });
  }
  deleteAnnouncement(id: string) {
    return this.prisma.announcement.delete({ where: { id } });
  }

  faqs() {
    return this.prisma.faq.findMany({ orderBy: { sortOrder: 'asc' } });
  }
  createFaq(data: any) {
    const payload = this.faqPayload(data) as {
      question: string;
      answer: string;
      sortOrder?: number;
      isActive?: boolean;
    };
    return this.prisma.faq.create({ data: payload });
  }
  updateFaq(id: string, data: any) {
    const payload = this.faqPayload(data, true) as {
      question?: string;
      answer?: string;
      sortOrder?: number;
      isActive?: boolean;
    };
    return this.prisma.faq.update({ where: { id }, data: payload });
  }
  deleteFaq(id: string) {
    return this.prisma.faq.delete({ where: { id } });
  }

  private faqPayload(data: any, partial = false) {
    const out: Record<string, unknown> = {};
    if (data.question != null || !partial) {
      const question = String(data.question || '').trim();
      if (!question) throw new BadRequestException('Question is required');
      out.question = question;
    }
    if (data.answer != null || !partial) {
      const answer = String(data.answer || '').trim();
      if (!answer) throw new BadRequestException('Answer is required');
      out.answer = answer;
    }
    if (data.sortOrder != null) out.sortOrder = Number(data.sortOrder) || 0;
    if (data.isActive != null) out.isActive = !!data.isActive;
    return out;
  }

  pages() {
    return this.prisma.cmsPage.findMany();
  }
  async upsertPage(body: { slug: string; title: string; body: string }) {
    return this.prisma.cmsPage.upsert({
      where: { slug: body.slug },
      create: body,
      update: { title: body.title, body: body.body },
    });
  }

  async createServiceRequest(user: AuthUser, body: any) {
    if (!user.organizationId) throw new NotFoundException('No organization');
    const message = String(body.message || '').trim();
    if (body.kind === 'CALLBACK' && !message) {
      throw new BadRequestException('Please enter the reason for your callback');
    }
    if (!message) {
      throw new BadRequestException('Message is required');
    }
    const req = await this.prisma.serviceRequest.create({
      data: {
        organizationId: user.organizationId,
        catalogId: body.catalogId || null,
        kind: body.kind || 'NEW',
        message,
      },
    });
    await this.prisma.notification.create({
      data: {
        type: 'SERVICE_REQUEST',
        title:
          body.kind === 'CALLBACK'
            ? 'Call requested'
            : body.kind === 'CONSULTING'
              ? 'Consulting request'
              : 'New service request',
        body: message.slice(0, 180),
      },
    });
    const settings = await this.prisma.appSettings.findUnique({ where: { id: 'default' } });
    await this.mail.send(
      settings?.email,
      body.kind === 'CALLBACK' ? 'Client requested a call' : 'New service request',
      this.mail.wrap(
        body.kind === 'CALLBACK' ? 'Callback reason' : 'Client request',
        `<p><strong>Client:</strong> organization linked to request</p><p>${message}</p>`,
      ),
    );
    return req;
  }

  listServiceRequests(user: AuthUser) {
    return this.prisma.serviceRequest.findMany({
      where: user.role === 'CLIENT' ? { organizationId: user.organizationId || '__none__' } : undefined,
      include: { organization: true, catalog: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateServiceRequest(id: string, status: string) {
    return this.prisma.serviceRequest.update({
      where: { id },
      data: { status: status as any },
    });
  }
}
