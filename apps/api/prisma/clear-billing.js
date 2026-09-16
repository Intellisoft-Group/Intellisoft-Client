/**
 * Clears all invoices, payments, and stage invoice links.
 * Keeps clients, catalog, projects (stages reset to PLANNED), users, etc.
 *
 * Usage: node prisma/clear-billing.js
 */
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing invoices, payments, and stage billing data…');

  await prisma.$transaction(async (tx) => {
    await tx.ticket.updateMany({ data: { invoiceId: null } });
    await tx.payment.deleteMany();
    await tx.invoiceLine.deleteMany();
    await tx.paymentStage.updateMany({
      data: { invoiceId: null, status: 'PLANNED' },
    });
    await tx.invoice.deleteMany();
    await tx.notification.deleteMany({
      where: { type: { in: ['INVOICE_DUE', 'PAYMENT_SUCCESS'] } },
    });
  });

  const dir = path.join(process.cwd(), 'uploads', 'invoices');
  if (fs.existsSync(dir)) {
    for (const name of fs.readdirSync(dir)) {
      if (name.toLowerCase().endsWith('.pdf')) {
        fs.unlinkSync(path.join(dir, name));
        console.log(`Removed ${name}`);
      }
    }
  }

  console.log('Done. Billing is empty — create invoices fresh, mark Paid, then upload PDFs manually.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
