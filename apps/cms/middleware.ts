import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** Known search / AI / archive crawlers — refuse access to this private CMS. */
const BOT_UA =
  /bot|crawl|spider|slurp|scrapy|httpclient|python-requests|curl\/|wget|GPTBot|ChatGPT|ClaudeBot|anthropic|CCBot|Bytespider|cohere|Perplexity|Applebot|Amazonbot|Diffbot|Imagesift|Semrush|Ahrefs|DotBot|MJ12|PetalBot|YouBot|ia_archiver|archive\.org|facebookexternalhit|meta-externalagent|OAI-SearchBot|Google-Extended|bingpreview|DuckDuckBot/i;

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || '';
  const path = request.nextUrl.pathname;

  // Always allow robots / ai policy files so polite crawlers can read the deny rules.
  if (path === '/robots.txt' || path === '/ai.txt') {
    const res = NextResponse.next();
    applyPrivateHeaders(res);
    return res;
  }

  if (BOT_UA.test(ua)) {
    return new NextResponse('Not available for automated access.', {
      status: 403,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate',
        'Cache-Control': 'no-store',
      },
    });
  }

  const res = NextResponse.next();
  applyPrivateHeaders(res);
  return res;
}

function applyPrivateHeaders(res: NextResponse) {
  res.headers.set(
    'X-Robots-Tag',
    'noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate',
  );
  res.headers.set('Referrer-Policy', 'no-referrer');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.headers.set('Cache-Control', 'private, no-store');
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|brand/).*)'],
};
