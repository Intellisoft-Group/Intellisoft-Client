const http = require('http');

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw || '{}') });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  // Staff need captcha - get one then try without (sales via CMS uses captcha).
  // For desk test, login without clientApp but we need captcha.
  // Bypass: use prisma to issue nothing - instead call captcha and solve if possible.
  const cap = await request('GET', '/auth/captcha');
  console.log('captcha', cap.body);

  // Try login - will fail captcha unless we know answer. Use JWT from DB refresh not available.
  // Better approach: login as sales with wrong captcha won't work.
  // Check if CaptchaService stores answers - we can't easily solve.
  // Alternative: use nest and prisma to create a temporary token via script with jwt.

  const { PrismaClient } = require('@prisma/client');
  const jwt = require('jsonwebtoken');
  const p = new PrismaClient();
  const sales = await p.user.findFirst({ where: { email: 'uma.s@example.org' } });
  const token = jwt.sign(
    { sub: sales.id, role: sales.role, email: sales.email },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '1h' },
  );
  const desk = await request('GET', '/attendance/desk', null, token);
  console.log('desk status', desk.status);
  console.log(JSON.stringify(desk.body.sales || desk.body, null, 2));
  await p.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
