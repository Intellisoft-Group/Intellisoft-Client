const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const sales = await p.user.findMany({
    where: { role: 'SALES' },
    select: { id: true, email: true, name: true, isActive: true },
  });
  console.log('SALES', JSON.stringify(sales, null, 2));

  try {
    const cols = await p.$queryRawUnsafe(
      "SELECT column_name FROM information_schema.columns WHERE table_name='Organization' AND column_name='salesPersonId'",
    );
    console.log('salesPersonId col', cols);
  } catch (e) {
    console.log('col check failed', e.message);
  }

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
