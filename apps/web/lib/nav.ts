export const NAV = [
  { href: '/', label: 'Home', icon: '⌂' },
  { href: '/bills', label: 'Bills', icon: '₹' },
  { href: '/services', label: 'Services', icon: '◎' },
  { href: '/projects', label: 'Projects', icon: '▣' },
  { href: '/faqs', label: 'FAQs', icon: '?' },
  { href: '/account', label: 'Account', icon: '☺' },
] as const;

export function navActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}
