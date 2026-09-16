const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

(async () => {
  const sales = await p.user.findFirst({ where: { role: 'SALES', email: 'uma.s@example.org' } });
  if (!sales) throw new Error('Sales user not found');

  const orgs = await p.organization.findMany({ take: 3, orderBy: { name: 'asc' } });
  console.log('Orgs before:', orgs.map((o) => ({ id: o.id, name: o.name })));

  for (const org of orgs) {
    await p.$executeRawUnsafe(
      `UPDATE "Organization" SET "salesPersonId" = $1 WHERE id = $2`,
      sales.id,
      org.id,
    );
  }

  const subs = await p.serviceSubscription.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: { organization: true, catalog: true },
  });

  for (const sub of subs) {
    await p.$executeRawUnsafe(
      `UPDATE "ServiceSubscription" SET "soldById" = $1, "soldAt" = COALESCE("soldAt", NOW()) WHERE id = $2`,
      sales.id,
      sub.id,
    );
  }

  const clientCount = await p.$queryRawUnsafe(
    `SELECT count(*)::int AS c FROM "Organization" WHERE "salesPersonId" = $1`,
    sales.id,
  );
  const saleCount = await p.$queryRawUnsafe(
    `SELECT count(*)::int AS c FROM "ServiceSubscription" WHERE "soldById" = $1`,
    sales.id,
  );

  console.log(
    JSON.stringify(
      {
        login: { email: sales.email, password: 'Sales@123', name: sales.name },
        attributedClients: clientCount[0]?.c,
        attributedSales: saleCount[0]?.c,
        clients: orgs.map((o) => o.name),
        services: subs.map((s) => `${s.catalog?.name || s.catalogId} → ${s.organization?.name}`),
      },
      null,
      2,
    ),
  );

  await p.$disconnect();
})().catch(async (e) => {
  console.error(e);
  await p.$disconnect();
  process.exit(1);
});
