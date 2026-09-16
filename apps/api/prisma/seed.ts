import { PrismaClient, Role, BillingCycle } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database…');
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET session_replication_role = 'replica'`);
    await tx.ticketMessage.deleteMany();
    await tx.ticket.deleteMany();
    await tx.chatReaction.deleteMany();
    await tx.chatPollVote.deleteMany();
    await tx.chatPollOption.deleteMany();
    await tx.chatRead.deleteMany();
    await tx.chatMessage.deleteMany();
    await tx.chatThread.deleteMany();
    await tx.projectMember.deleteMany();
    await tx.projectUpdate.deleteMany();
    await tx.milestone.deleteMany();
    await tx.project.deleteMany();
    await tx.payment.deleteMany();
    await tx.invoiceLine.deleteMany();
    await tx.invoice.deleteMany();
    await tx.serviceRequest.deleteMany();
    await tx.serviceSubscription.deleteMany();
    await tx.serviceCatalog.deleteMany();
    await tx.document.deleteMany();
    await tx.notification.deleteMany();
    await tx.attendancePunch.deleteMany();
    await tx.leaveRequest.deleteMany();
    await tx.appBanner.deleteMany();
    await tx.announcement.deleteMany();
    await tx.faq.deleteMany();
    await tx.cmsPage.deleteMany();
    await tx.user.deleteMany();
    await tx.organization.deleteMany();
    await tx.appSettings.deleteMany();
    await tx.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
  });

  await prisma.appSettings.create({
    data: {
      id: 'default',
      companyName: 'Intellisoft',
      legalName: 'Repute Media Private Limited',
      gstin: '29AABCI1234A1Z5',
      pan: 'AABCI1234A',
      email: 'chief@theintellisoft.com',
      phone: '+91 80 4123 4500',
      address: '12, MG Road, Bengaluru',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      country: 'India',
      bankName: 'HDFC Bank',
      bankAccount: '50200011223344',
      bankIfsc: 'HDFC0001234',
      bankBranch: 'MG Road',
      primaryColor: '#0D9488',
      splashCopy: 'Bills, services and support — in one place',
      maintenanceMode: false,
      minAppVersion: '1.0.0',
      defaultTaxPercent: 18,
    },
  });

  const hash = (p: string) => bcrypt.hash(p, 10);

  const staff = [
    {
      email: process.env.SUPER_ADMIN_EMAIL || 'chief@theintellisoft.com',
      name: 'Chief',
      phone: '+91 98765 00001',
      role: Role.SUPER_ADMIN,
      password: process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe@LocalOnly',
    },
    {
      email: 'sarah.b@example.net',
      name: 'Rahul Mehta',
      phone: '+91 98765 00002',
      role: Role.FINANCE,
      password: 'Finance@123',
    },
    {
      email: 'anita.desai@intellisoft.in',
      name: 'Anita Desai',
      phone: '+91 98765 00003',
      role: Role.SUPPORT,
      password: 'Support@123',
    },
    {
      email: 'uma.s@example.org',
      name: 'Vikram Rao',
      phone: '+91 98765 00004',
      role: Role.SALES,
      password: 'Sales@123',
    },
  ];
  for (const s of staff) {
    await prisma.user.upsert({
      where: { email: s.email },
      update: {
        name: s.name,
        phone: s.phone,
        role: s.role,
        passwordHash: await hash(s.password),
        isActive: true,
      },
      create: {
        email: s.email,
        name: s.name,
        phone: s.phone,
        role: s.role,
        passwordHash: await hash(s.password),
      },
    });
  }

  const acme = await prisma.organization.create({
    data: {
      name: 'Acme Industries',
      legalName: 'Acme Industries Pvt Ltd',
      gstin: '29AACCA1111B1Z2',
      pan: 'AACCA1111B',
      email: 'accounts@acme.test',
      phone: '+91 80 2555 1000',
      billingAddress: '45, Whitefield, Bengaluru 560066',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560066',
      placeOfSupply: 'Karnataka',
      notes: 'Flagship AMC + hosting client',
    },
  });

  const globex = await prisma.organization.create({
    data: {
      name: 'Globex Corp',
      legalName: 'Globex Corporation LLC',
      email: 'billing@globex.test',
      phone: '+1 415 555 0199',
      billingAddress: '88 Market St, San Francisco, CA',
      city: 'San Francisco',
      state: 'California',
      pincode: '94105',
      country: 'United States',
      placeOfSupply: 'California',
      notes: 'International product engineering retainer',
    },
  });

  await prisma.user.create({
    data: {
      email: 'client@acme.test',
      name: 'Sanjay Kapoor',
      phone: '+91 98765 11111',
      role: Role.CLIENT,
      organizationId: acme.id,
      passwordHash: await hash('Client@123'),
    },
  });

  await prisma.user.create({
    data: {
      email: 'billing@globex.test',
      name: 'Elena Cruz',
      phone: '+1 415 555 0102',
      role: Role.CLIENT,
      organizationId: globex.id,
      passwordHash: await hash('Client@123'),
    },
  });

  const catalogItems = [
    {
      name: 'Business Website Hosting',
      slug: 'business-website-hosting',
      description: 'Managed VPS hosting, SSL, daily backups and 99.9% uptime SLA.',
      category: 'Hosting',
      sacCode: '998315',
      price: 18000,
      taxPercent: 18,
      billingCycle: BillingCycle.YEARLY,
      features: ['VPS', 'SSL', 'Daily backups', '24x7 monitoring'],
    },
    {
      name: 'Annual Maintenance Contract',
      slug: 'annual-maintenance-contract',
      description: 'Application support, patches, and 8-hour response SLA.',
      category: 'Support',
      sacCode: '998313',
      price: 96000,
      taxPercent: 18,
      billingCycle: BillingCycle.YEARLY,
      features: ['8-hour SLA', 'Unlimited tickets', 'Monthly health report'],
    },
    {
      name: 'Custom Software Development',
      slug: 'custom-software-development',
      description: 'Dedicated engineering for new features and integrations.',
      category: 'Development',
      sacCode: '998314',
      price: 250000,
      taxPercent: 18,
      billingCycle: BillingCycle.ONE_TIME,
      features: ['Product discovery', 'Sprint delivery', 'UAT'],
    },
    {
      name: 'Microsoft 365 Business',
      slug: 'microsoft-365-business',
      description: 'Licensed Microsoft 365 seats with Intellisoft administration.',
      category: 'Licenses',
      sacCode: '998439',
      price: 7200,
      taxPercent: 18,
      billingCycle: BillingCycle.YEARLY,
      features: ['Admin portal', 'Backup', 'Onboarding'],
    },
    {
      name: 'Cloud Infrastructure',
      slug: 'cloud-infrastructure',
      description: 'AWS / Azure landing zone, cost control and security baseline.',
      category: 'Cloud',
      sacCode: '998315',
      price: 45000,
      taxPercent: 18,
      billingCycle: BillingCycle.MONTHLY,
      features: ['Landing zone', 'FinOps review', 'Guardrails'],
    },
  ];

  const catalog: any[] = [];
  for (const item of catalogItems) {
    catalog.push(await prisma.serviceCatalog.create({ data: item }));
  }

  const bySlug = Object.fromEntries(catalog.map((c) => [c.slug, c]));

  const acmeHost = await prisma.serviceSubscription.create({
    data: {
      organizationId: acme.id,
      catalogId: bySlug['business-website-hosting'].id,
      status: 'ACTIVE',
      startDate: new Date('2026-01-01'),
      renewalDate: new Date('2027-01-01'),
      slaNotes: 'Priority P1 within 4 hours',
    },
  });
  await prisma.serviceSubscription.create({
    data: {
      organizationId: acme.id,
      catalogId: bySlug['annual-maintenance-contract'].id,
      status: 'ACTIVE',
      startDate: new Date('2026-04-01'),
      renewalDate: new Date('2027-04-01'),
    },
  });
  await prisma.serviceSubscription.create({
    data: {
      organizationId: globex.id,
      catalogId: bySlug['custom-software-development'].id,
      status: 'ACTIVE',
      startDate: new Date('2026-02-01'),
      customPrice: 12000,
      notes: 'Billed in USD monthly equivalent on invoice',
    },
  });

  const admin = await prisma.user.findUnique({ where: { email: 'chief@theintellisoft.com' } });
  const support = await prisma.user.findUnique({ where: { email: 'anita.desai@intellisoft.in' } });
  const finance = await prisma.user.findUnique({ where: { email: 'sarah.b@example.net' } });
  const sales = await prisma.user.findUnique({ where: { email: 'uma.s@example.org' } });
  const client = await prisma.user.findUnique({ where: { email: 'client@acme.test' } });

  const ticket = await prisma.ticket.create({
    data: {
      number: 'TCK-2026-0001',
      organizationId: acme.id,
      subscriptionId: acmeHost.id,
      assigneeId: support?.id,
      subject: 'SSL certificate renewal warning on staging',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
    },
  });
  await prisma.ticketMessage.createMany({
    data: [
      {
        ticketId: ticket.id,
        authorId: client!.id,
        body: 'Staging shows the SSL will expire in 12 days. Please renew.',
      },
      {
        ticketId: ticket.id,
        authorId: support!.id,
        body: 'We have queued the renewal. Production is unaffected. ETA 24 hours.',
      },
    ],
  });

  const dealerPortal = await prisma.project.create({
    data: {
      organizationId: acme.id,
      name: 'Dealer portal revamp',
      description: 'Next.js rewrite of the dealer ordering portal.',
      status: 'IN_PROGRESS',
      startDate: new Date('2026-06-01'),
      dueDate: new Date('2026-10-15'),
      milestones: {
        create: [
          { title: 'Discovery & IA', completed: true, sortOrder: 0 },
          { title: 'MVP build', completed: false, sortOrder: 1, dueDate: new Date('2026-09-01') },
          { title: 'UAT & go-live', completed: false, sortOrder: 2, dueDate: new Date('2026-10-15') },
        ],
      },
      updates: {
        create: [{ body: 'Sprint 4 shipped inventory search. UAT scheduled for 8 Sep.' }],
      },
    },
  });

  if (support) {
    await prisma.projectMember.create({
      data: { projectId: dealerPortal.id, userId: support.id },
    });
  }
  if (sales) {
    await prisma.projectMember.create({
      data: { projectId: dealerPortal.id, userId: sales.id },
    });
  }

  const morning = new Date();
  morning.setHours(9, 12, 0, 0);
  const lunchOut = new Date();
  lunchOut.setHours(13, 5, 0, 0);
  const lunchIn = new Date();
  lunchIn.setHours(13, 45, 0, 0);
  const punches: { userId: string; type: 'IN' | 'OUT'; at: Date; note?: string }[] = [];
  if (support) punches.push({ userId: support.id, type: 'IN', at: morning, note: 'Client SLAs' });
  if (finance) {
    punches.push({ userId: finance.id, type: 'IN', at: new Date(morning.getTime() + 18 * 60000) });
    punches.push({ userId: finance.id, type: 'OUT', at: lunchOut, note: 'Lunch' });
    punches.push({ userId: finance.id, type: 'IN', at: lunchIn });
  }
  if (sales) punches.push({ userId: sales.id, type: 'IN', at: new Date(morning.getTime() + 40 * 60000) });
  if (admin) punches.push({ userId: admin.id, type: 'IN', at: new Date(morning.getTime() - 20 * 60000) });
  if (punches.length) await prisma.attendancePunch.createMany({ data: punches });

  if (support) {
    await prisma.leaveRequest.create({
      data: {
        userId: support.id,
        fromDate: new Date('2026-09-08'),
        toDate: new Date('2026-09-09'),
        reason: 'Personal work',
        status: 'PENDING',
      },
    });
  }

  const acmeThread = await prisma.chatThread.create({
    data: { kind: 'ORGANIZATION', organizationId: acme.id },
  });
  await prisma.chatThread.create({
    data: { kind: 'ORGANIZATION', organizationId: globex.id },
  });
  const projectThread = await prisma.chatThread.create({
    data: { kind: 'PROJECT', organizationId: acme.id, projectId: dealerPortal.id },
  });

  if (client && support) {
    await prisma.chatMessage.createMany({
      data: [
        {
          threadId: acmeThread.id,
          authorId: client.id,
          body: 'Please share the latest invoice and AMC coverage letter for our auditors.',
        },
        {
          threadId: acmeThread.id,
          authorId: support.id,
          body: 'We will upload the AMC letter to Documents today. Invoices appear in Bills after they are issued.',
        },
        {
          threadId: projectThread.id,
          authorId: client.id,
          body: 'Uploading the brand guidelines PDF for the dealer portal. Please use these colours.',
        },
        {
          threadId: projectThread.id,
          authorId: support.id,
          body: 'Received. The design team will apply them in the next sprint.',
        },
      ],
    });
  }

  await prisma.document.create({
    data: {
      organizationId: acme.id,
      projectId: dealerPortal.id,
      uploadedById: client?.id,
      title: 'Brand guidelines (client)',
      type: 'OTHER',
      source: 'CLIENT',
      fileName: 'acme-brand-guidelines.txt',
      mimeType: 'text/plain',
      filePath: 'uploads/documents/seed-brand-guidelines.txt',
    },
  });

  await prisma.appBanner.createMany({
    data: [
      {
        title: 'Pay invoices in the app',
        body: 'Bank transfer details are in Bills. After payment is confirmed, your invoice PDF appears for download.',
        imageUrl: 'uploads/brand/banner-pay.png',
        sortOrder: 0,
        isActive: true,
      },
      {
        title: 'Keep AMC coverage live',
        body: 'Renew before the due date so SLA response times never drop.',
        imageUrl: 'uploads/brand/banner-team.png',
        sortOrder: 1,
        isActive: true,
      },
    ],
  });

  await prisma.announcement.create({
    data: {
      title: 'Scheduled maintenance window',
      body: 'Intellisoft monitoring will run a planned upgrade on 5 Sep, 01:00–03:00 IST. No client downtime expected.',
      isPinned: true,
      isActive: true,
    },
  });

  await prisma.faq.createMany({
    data: [
      {
        question: 'Who is Intellisoft?',
        answer:
          'Intellisoft is an IT services company that designs, builds, hosts, and supports digital products for businesses. We partner with clients as a long-term technology team—not a one-time vendor.',
        sortOrder: 0,
      },
      {
        question: 'What services does Intellisoft provide?',
        answer:
          'We deliver software development, websites and web apps, cloud and hosting, IT support, AMC, and related digital services. Each engagement is scoped to your business goals, timeline, and budget.',
        sortOrder: 1,
      },
      {
        question: 'Do you serve clients online across the globe?',
        answer:
          'Yes. Intellisoft works with clients online and delivers services remotely, so we can support businesses in India and across the world. Communication, delivery reviews, billing, and support all run through secure digital channels—including this client app and portal.',
        sortOrder: 2,
      },
      {
        question: 'How does an engagement with Intellisoft typically work?',
        answer:
          'We begin with your requirements, agree the scope and commercial terms, then deliver in clear stages. You can track projects, invoices, files, and support updates in the Intellisoft client app throughout the engagement.',
        sortOrder: 3,
      },
      {
        question: 'How do I pay an invoice?',
        answer:
          'Open Bills, select the invoice, and choose Clear invoice. Transfer the amount using the bank details shown and include the invoice number as the payment reference. After we confirm receipt, the invoice is marked Paid.',
        sortOrder: 4,
      },
      {
        question: 'How do I get support for a live service or project?',
        answer:
          'Use the Support section in the app to raise a ticket. Describe the issue clearly and attach details where helpful. Our team responds in-app so you have a full record of the conversation.',
        sortOrder: 5,
      },
      {
        question: 'Where can I track project progress and share files?',
        answer:
          'Open Projects to view milestones, payment stages, chat, and project files. You can upload logos, briefs, contracts, and delivery assets so both teams work from the same source of truth.',
        sortOrder: 6,
      },
      {
        question: 'Can I download invoice PDFs?',
        answer:
          'Yes. When an invoice PDF is available, a download option appears on that invoice in Bills. If a PDF is still pending, our finance team will upload it after the document is ready.',
        sortOrder: 7,
      },
      {
        question: 'How is my business information protected?',
        answer:
          'Access to the client app is limited to authorised accounts for your organisation. Files, invoices, and support history are handled through Intellisoft systems under your service agreement and our operational security practices.',
        sortOrder: 8,
      },
      {
        question: 'How do I start a new project or request additional services?',
        answer:
          'Contact your Intellisoft account manager, or use in-app chat / Support to share your requirement. Our team will confirm scope, commercial terms, and next steps before work begins.',
        sortOrder: 9,
      },
    ],
  });

  await prisma.cmsPage.createMany({
    data: [
      {
        slug: 'about',
        title: 'About Intellisoft',
        body: 'Intellisoft is an IT services company delivering software, hosting, cloud and ongoing support for businesses.',
      },
      {
        slug: 'terms',
        title: 'Terms of service',
        body: 'Use of the Intellisoft Client app is governed by your master services agreement and these terms.',
      },
    ],
  });

  console.log(
    `Seed complete. CMS admin: ${staff[0].email} (password from SUPER_ADMIN_PASSWORD or ChangeMe@LocalOnly). Mobile: client@acme.test / Client@123`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
