const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  // Monorepo: include workspace root so standalone has all traced deps (otherwise server.js crashes in Docker).
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async headers() {
    const privateTag = 'noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate';
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: privateTag },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Permissions-Policy', value: 'interest-cohort=(), browsing-topics=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
