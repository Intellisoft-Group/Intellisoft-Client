/**
 * Wipe all demo/business data. Keep only one SUPER_ADMIN account.
 *
 * Usage (apps/api or Docker /app):
 *   SUPER_ADMIN_EMAIL=chief@theintellisoft.com \
 *   SUPER_ADMIN_PASSWORD='MR_970-TheChief' \
 *   SUPER_ADMIN_NAME='Chief' \
 *   node prisma/wipe-keep-super-admin.js
 *
 * Never commit real passwords into this file.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'chief@theintellisoft.com').trim().toLowerCase();
const PASSWORD = (process.env.SUPER_ADMIN_PASSWORD || '').trim();
const NAME = (process.env.SUPER_ADMIN_NAME || 'Chief').trim();

async function main() {
  if (!PASSWORD || PASSWORD.length < 8) {
    throw new Error('Set SUPER_ADMIN_PASSWORD (min 8 chars) in the environment.');
  }

  const prisma = new PrismaClient();
  try {
    console.log('Wiping all business data…');

    await prisma.$transaction(async (tx) => {
      // Chat
      await tx.chatPollVote.deleteMany();
      await tx.chatReaction.deleteMany();
      await tx.chatRead.deleteMany();
      await tx.chatPollOption.deleteMany();
      await tx.chatMessage.deleteMany();
      await tx.chatThread.deleteMany();

      // Support / docs
      await tx.ticketMessage.deleteMany();
      await tx.ticket.deleteMany();
      await tx.document.deleteMany();

      // Billing
      await tx.payment.deleteMany();
      await tx.invoiceLine.deleteMany();
      await tx.paymentStage.deleteMany();
      await tx.invoice.deleteMany();

      // Projects
      await tx.milestone.deleteMany();
      await tx.projectUpdate.deleteMany();
      await tx.projectMember.deleteMany();
      await tx.project.deleteMany();

      // Commercial
      await tx.serviceRequest.deleteMany();
      await tx.serviceSubscription.deleteMany();
      await tx.serviceCatalog.deleteMany();
      await tx.notification.deleteMany();

      // HR / ops
      await tx.attendancePunch.deleteMany();
      await tx.leaveRequest.deleteMany();
      await tx.jobTitle.deleteMany();

      // CMS content
      await tx.appBanner.deleteMany();
      await tx.announcement.deleteMany();
      await tx.faq.deleteMany();
      await tx.cmsPage.deleteMany();

      // Clients + all users (recreate chief after)
      await tx.user.deleteMany();
      await tx.organization.deleteMany();
    });

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const admin = await prisma.user.create({
      data: {
        email: EMAIL,
        name: NAME,
        role: 'SUPER_ADMIN',
        passwordHash,
        isActive: true,
        mustChangePassword: false,
      },
      select: { id: true, email: true, role: true, name: true },
    });

    await prisma.appSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        companyName: 'Intellisoft',
        legalName: 'Intellisoft',
        email: EMAIL,
        state: 'Karnataka',
        country: 'India',
        splashCopy: 'Services, invoices and payments',
        chargesTax: false,
        defaultTaxPercent: 18,
      },
      update: {
        companyName: 'Intellisoft',
        legalName: 'Intellisoft',
        email: EMAIL,
        // Keep bank fields if already set; do not wipe settlement account blindly.
      },
    });

    console.log('Done. Database cleaned.');
    console.log('Super admin kept/created:', admin);
    console.log('Sign in at CMS with that email and the password you passed in SUPER_ADMIN_PASSWORD.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
