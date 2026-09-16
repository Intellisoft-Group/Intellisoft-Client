import { IBM_Plex_Sans } from 'next/font/google';
import './globals.css';
import type { Metadata } from 'next';

const ibmPlex = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-ibm-plex',
});

export const metadata: Metadata = {
  title: 'Intellisoft · CMS',
  description: 'Intellisoft staff CMS',
  applicationName: 'Intellisoft CMS',
  icons: { icon: '/brand/icon.png', apple: '/brand/icon-192.png' },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      'max-video-preview': -1,
      'max-image-preview': 'none',
      'max-snippet': -1,
    },
  },
  other: {
    googlebot: 'noindex, nofollow, noarchive, nosnippet, noimageindex',
    bingbot: 'noindex, nofollow, noarchive, nosnippet',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={ibmPlex.variable}>
      <head>
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex, notranslate" />
        <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
        <meta name="bingbot" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="AdsBot-Google" content="noindex, nofollow" />
        <meta name="referrer" content="no-referrer" />
      </head>
      <body className={ibmPlex.className}>{children}</body>
    </html>
  );
}
