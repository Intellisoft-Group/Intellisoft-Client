const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  try {
    const r = await p.organization.findFirst({ select: { id: true, salesPersonId: true, name: true } });
    console.log('org', r);
    const sales = await p.user.findFirst({ where: { email: 'uma.s@example.org' } });
    console.log('sales', sales?.id, sales?.role);
    if (sales) {
      const n = await p.organization.count({ where: { salesPersonId: sales.id } });
      const s = await p.serviceSubscription.count({ where: { soldById: sales.id } });
      console.log('counts', { clients: n, sales: s });
    }
  } catch (e) {
    console.log('ERR', e.message);
  } finally {
    await p.$disconnect();
  }
})();
