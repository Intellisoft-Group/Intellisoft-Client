/**
 * One-off ops: remove legacy admin@intellisoft.in and ensure a SUPER_ADMIN account.
 *
 * Usage (from apps/api):
 *   SUPER_ADMIN_EMAIL=chief@theintellisoft.com SUPER_ADMIN_PASSWORD='***' node prisma/update-super-admin.js
 *
 * Never commit real passwords into this file.
 */
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const OLD_EMAIL = 'nathan.k@example.net';
const NEW_EMAIL = (process.env.SUPER_ADMIN_EMAIL || 'chief@theintellisoft.com').trim();
const NEW_PASSWORD = (process.env.SUPER_ADMIN_PASSWORD || '').trim();
const NEW_NAME = (process.env.SUPER_ADMIN_NAME || 'Chief').trim();

async function main() {
  if (!NEW_PASSWORD || NEW_PASSWORD.length < 8) {
    throw new Error('Set SUPER_ADMIN_PASSWORD (min 8 chars) in the environment — do not hardcode it.');
  }

  const prisma = new PrismaClient();
  try {
    const passwordHash = await bcrypt.hash(NEW_PASSWORD, 10);
    const old = await prisma.user.findUnique({ where: { email: OLD_EMAIL } });
    const existingNew = await prisma.user.findUnique({ where: { email: NEW_EMAIL } });

    if (old && !existingNew) {
      await prisma.user.update({
        where: { id: old.id },
        data: {
          email: NEW_EMAIL,
          name: NEW_NAME,
          role: 'SUPER_ADMIN',
          passwordHash,
          isActive: true,
          mustChangePassword: false,
          refreshTokenHash: null,
          resetToken: null,
          resetTokenExpires: null,
        },
      });
      console.log(`Renamed ${OLD_EMAIL} → ${NEW_EMAIL} and reset password`);
    } else if (old && existingNew && old.id !== existingNew.id) {
      await prisma.ticket.updateMany({ where: { assigneeId: old.id }, data: { assigneeId: existingNew.id } });
      await prisma.organization.updateMany({ where: { salesPersonId: old.id }, data: { salesPersonId: existingNew.id } });
      await prisma.serviceSubscription.updateMany({ where: { soldById: old.id }, data: { soldById: existingNew.id } });
      await prisma.projectMember.deleteMany({ where: { userId: old.id } });
      await prisma.notification.deleteMany({ where: { userId: old.id } });
      await prisma.attendancePunch.deleteMany({ where: { userId: old.id } });
      await prisma.leaveRequest.deleteMany({ where: { userId: old.id } });
      await prisma.chatRead.deleteMany({ where: { userId: old.id } });
      await prisma.chatReaction.deleteMany({ where: { userId: old.id } });
      await prisma.chatPollVote.deleteMany({ where: { userId: old.id } });
      await prisma.document.updateMany({ where: { uploadedById: old.id }, data: { uploadedById: existingNew.id } });
      await prisma.ticketMessage.updateMany({ where: { authorId: old.id }, data: { authorId: existingNew.id } });
      await prisma.chatMessage.updateMany({ where: { authorId: old.id }, data: { authorId: existingNew.id } });
      await prisma.user.delete({ where: { id: old.id } });
      await prisma.user.update({
        where: { id: existingNew.id },
        data: {
          name: NEW_NAME,
          role: 'SUPER_ADMIN',
          passwordHash,
          isActive: true,
          mustChangePassword: false,
          refreshTokenHash: null,
          resetToken: null,
          resetTokenExpires: null,
        },
      });
      console.log(`Deleted ${OLD_EMAIL}; updated ${NEW_EMAIL}`);
    } else if (existingNew) {
      await prisma.user.update({
        where: { id: existingNew.id },
        data: {
          name: NEW_NAME,
          role: 'SUPER_ADMIN',
          passwordHash,
          isActive: true,
          mustChangePassword: false,
          refreshTokenHash: null,
          resetToken: null,
          resetTokenExpires: null,
        },
      });
      console.log(`Updated existing ${NEW_EMAIL}`);
    } else {
      await prisma.user.create({
        data: {
          email: NEW_EMAIL,
          name: NEW_NAME,
          role: 'SUPER_ADMIN',
          passwordHash,
          isActive: true,
          mustChangePassword: false,
        },
      });
      console.log(`Created ${NEW_EMAIL}`);
    }

    const leftover = await prisma.user.findUnique({ where: { email: OLD_EMAIL } });
    if (leftover) {
      await prisma.user.delete({ where: { id: leftover.id } });
      console.log(`Removed leftover ${OLD_EMAIL}`);
    }

    await prisma.appSettings.updateMany({
      where: { email: OLD_EMAIL },
      data: { email: NEW_EMAIL },
    });

    const admin = await prisma.user.findUnique({
      where: { email: NEW_EMAIL },
      select: { id: true, email: true, role: true, isActive: true },
    });
    console.log('Super admin:', admin);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
