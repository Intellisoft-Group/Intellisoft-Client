export type StaffRole = 'SUPER_ADMIN' | 'FINANCE' | 'SUPPORT' | 'SALES';

export function isAdmin(role?: string | null) {
  return role === 'SUPER_ADMIN';
}

export function isOfficeTeam(role?: string | null) {
  return !!role && role !== 'CLIENT';
}

export function homeFor(role?: string | null) {
  return isAdmin(role) ? '/dashboard' : '/desk';
}

/**
 * Route / feature access.
 * SUPER_ADMIN may open any staff route.
 */
export function canSee(role: string | undefined, allowed: StaffRole[]) {
  if (!role) return false;
  if (role === 'SUPER_ADMIN') return true;
  return allowed.includes(role as StaffRole);
}

type NavItem = { href?: string; label?: string; icon?: string; group?: string; roles?: StaffRole[] };

const ALL: StaffRole[] = ['SUPER_ADMIN', 'FINANCE', 'SUPPORT', 'SALES'];
const ADMIN: StaffRole[] = ['SUPER_ADMIN'];
const SALES: StaffRole[] = ['SALES'];
const FINANCE: StaffRole[] = ['FINANCE'];
const SUPPORT: StaffRole[] = ['SUPPORT'];
const SALES_ADMIN: StaffRole[] = ['SUPER_ADMIN', 'SALES'];
const FINANCE_ADMIN: StaffRole[] = ['SUPER_ADMIN', 'FINANCE'];
const COMMERCIAL: StaffRole[] = ['SUPER_ADMIN', 'FINANCE', 'SALES'];
const DELIVERY: StaffRole[] = ['SUPER_ADMIN', 'SUPPORT', 'SALES'];
const CLIENT_CRM: StaffRole[] = ['SUPER_ADMIN', 'FINANCE', 'SALES'];
const FIELD: StaffRole[] = ['FINANCE', 'SUPPORT', 'SALES'];
/** Service requests → quote path (matches API PATCH roles). */
const REQUESTS: StaffRole[] = ['SUPER_ADMIN', 'SALES'];
/** Tickets owned by support; sales may follow for client context. */
const TICKETS: StaffRole[] = ['SUPER_ADMIN', 'SUPPORT', 'SALES'];
/** Broadcast announcements — finance/sales/admin (org picker matches API). */
const CONTENT: StaffRole[] = ['SUPER_ADMIN', 'FINANCE', 'SALES'];

/**
 * Slim sidebar by role.
 *
 * SUPER_ADMIN — full CMS
 * SALES — desk, clients, requests, quotes, catalog, subscriptions, delivery, chat, FAQs, announcements
 * FINANCE — desk, clients, invoices, payments, subscriptions, reports, catalog, chat, announcements, settings
 * SUPPORT — desk, projects, tickets, project files, chat
 */
const NAV_CATALOG: NavItem[] = [
  { group: 'Home', roles: ALL },
  { href: '/dashboard', label: 'Dashboard', icon: '▣', roles: ADMIN },
  { href: '/desk', label: 'My desk', icon: '▣', roles: FIELD },
  { href: '/attendance', label: 'My attendance', icon: '◷', roles: ALL },
  { href: '/team', label: 'Team attendance', icon: '♟', roles: ADMIN },
  { href: '/sales', label: 'Sales tracking', icon: '◈', roles: SALES_ADMIN },

  { group: 'Clients', roles: [...new Set([...CLIENT_CRM, ...ALL])] as StaffRole[] },
  { href: '/clients', label: 'Clients', icon: '◎', roles: CLIENT_CRM },
  { href: '/leads', label: 'Requests', icon: '✦', roles: REQUESTS },
  { href: '/inbox', label: 'Chat', icon: '✉', roles: ALL },

  { group: 'Billing', roles: COMMERCIAL },
  { href: '/catalog', label: 'Catalog', icon: '▦', roles: COMMERCIAL },
  { href: '/billing?type=PROFORMA', label: 'Quotes', icon: '☰', roles: SALES_ADMIN },
  { href: '/billing', label: 'Invoices', icon: '₹', roles: FINANCE_ADMIN },
  { href: '/payments', label: 'Payments', icon: '▹', roles: FINANCE_ADMIN },
  { href: '/subscriptions', label: 'Subscriptions', icon: '↻', roles: COMMERCIAL },
  { href: '/reports', label: 'Reports', icon: '▦', roles: FINANCE_ADMIN },

  { group: 'Delivery', roles: DELIVERY },
  { href: '/projects', label: 'Projects', icon: '▣', roles: DELIVERY },
  { href: '/tickets', label: 'Tickets', icon: '⚑', roles: TICKETS },
  { href: '/documents', label: 'Project files', icon: '▤', roles: DELIVERY },

  { group: 'Content', roles: [...CONTENT, ...SALES_ADMIN] as StaffRole[] },
  { href: '/notifications', label: 'Announcements', icon: '◉', roles: CONTENT },
  { href: '/faqs', label: 'FAQs', icon: '?', roles: SALES_ADMIN },

  { group: 'Admin', roles: [...ADMIN, ...FINANCE] as StaffRole[] },
  { href: '/staff', label: 'Staff & roles', icon: '♟', roles: ADMIN },
  { href: '/settings', label: 'Settings', icon: '⚙', roles: FINANCE_ADMIN },
];

const ROUTE_ROLES: { prefix: string; roles: StaffRole[] }[] = [
  { prefix: '/dashboard', roles: ADMIN },
  { prefix: '/desk', roles: FIELD },
  { prefix: '/team', roles: ADMIN },
  { prefix: '/staff', roles: ADMIN },
  { prefix: '/settings', roles: FINANCE_ADMIN },
  { prefix: '/sales', roles: SALES_ADMIN },
  { prefix: '/clients', roles: CLIENT_CRM },
  { prefix: '/leads', roles: REQUESTS },
  { prefix: '/inbox', roles: ALL },
  { prefix: '/projects', roles: DELIVERY },
  { prefix: '/tickets', roles: TICKETS },
  { prefix: '/documents', roles: DELIVERY },
  { prefix: '/catalog', roles: COMMERCIAL },
  { prefix: '/subscriptions', roles: COMMERCIAL },
  { prefix: '/renewals', roles: COMMERCIAL }, // legacy URL → subscriptions renewals tab
  { prefix: '/billing', roles: COMMERCIAL },
  { prefix: '/payments', roles: FINANCE_ADMIN },
  { prefix: '/reports', roles: FINANCE_ADMIN },
  { prefix: '/notifications', roles: CONTENT },
  { prefix: '/faqs', roles: SALES_ADMIN },
  { prefix: '/attendance', roles: ALL },
];

function visibleTo(item: NavItem, role: StaffRole) {
  return (item.roles || []).includes(role);
}

/** Sidebar for the signed-in staff role. Dedupes by full href (keeps Quotes + Invoices). */
export function navFor(role?: string | null) {
  const key = (role || '') as StaffRole;
  if (!ALL.includes(key) && key !== 'SUPER_ADMIN') return [];

  const out: NavItem[] = [];
  const seenHref = new Set<string>();

  for (let i = 0; i < NAV_CATALOG.length; i++) {
    const item = NAV_CATALOG[i];
    if (item.group) {
      let linkCount = 0;
      let j = i + 1;
      while (j < NAV_CATALOG.length && !NAV_CATALOG[j].group) {
        const link = NAV_CATALOG[j];
        if (link.href && visibleTo(link, key) && !seenHref.has(link.href)) linkCount += 1;
        j += 1;
      }
      if (linkCount > 0 && visibleTo(item, key)) out.push({ group: item.group });
      continue;
    }
    if (!item.href || !visibleTo(item, key) || seenHref.has(item.href)) continue;
    seenHref.add(item.href);
    out.push({ href: item.href, label: item.label, icon: item.icon });
  }
  return out;
}

/** Match sidebar link against current route (including ?type= filters). */
export function navLinkActive(pathname: string, search: string, href: string) {
  const [path, query] = href.split('?');
  const onPath = pathname === path || pathname.startsWith(`${path}/`);
  if (!onPath) return false;
  if (!query) {
    if (path === '/billing' && search.includes('type=PROFORMA')) return false;
    return true;
  }
  const expected = new URLSearchParams(query);
  const actual = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const [k, v] of expected.entries()) {
    if (actual.get(k) !== v) return false;
  }
  return true;
}

export function allowedPath(pathname: string, role?: string | null) {
  const rule = ROUTE_ROLES.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  if (!rule) return true;
  return canSee(role || undefined, rule.roles);
}

export function roleWorkspaceLabel(role?: string | null) {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Administration';
    case 'SALES':
      return 'Sales';
    case 'FINANCE':
      return 'Finance';
    case 'SUPPORT':
      return 'Support';
    default:
      return 'Staff';
  }
}

/** Shared role groups for UI gating (buttons/links outside the sidebar). */
export const ROLE_GROUPS = {
  commercial: COMMERCIAL,
  delivery: DELIVERY,
  clientCrm: CLIENT_CRM,
  intake: REQUESTS,
  financeAdmin: FINANCE_ADMIN,
  salesAdmin: SALES_ADMIN,
  admin: ADMIN,
  content: CONTENT,
  tickets: TICKETS,
} as const;
