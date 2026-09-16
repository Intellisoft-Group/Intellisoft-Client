function resolveApiBase() {
  const configured = (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.API_PUBLIC_URL ||
    ''
  ).trim();
  if (configured) return configured.replace(/\/$/, '');
  if (process.env.NODE_ENV === 'production') {
    // Prefer baking NEXT_PUBLIC_API_URL at Docker build; keep a safe fallback so SSR does not 500.
    console.error('NEXT_PUBLIC_API_URL missing at runtime — using production API host');
    return 'https://api-client.theintellisoft.com';
  }
  return 'http://localhost:3000';
}

const API = resolveApiBase();

type ApiOpts = {
  method?: string;
  body?: unknown;
  token?: string | null;
  form?: FormData;
  /** @internal single retry after token refresh */
  _retry?: boolean;
};

let refreshPromise: Promise<string | null> | null = null;

function upgradeSameHostToHttps(url: string, apiBase: string) {
  try {
    const u = new URL(url);
    const b = new URL(apiBase);
    if (u.hostname === b.hostname && b.protocol === 'https:' && u.protocol === 'http:') {
      u.protocol = 'https:';
      return u.toString();
    }
  } catch {
    /* keep original */
  }
  return url;
}

export function fileUrl(path?: string | null) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return upgradeSameHostToHttps(path, API);
  }
  return `${API}/${path.replace(/^\/+/, '').replace(/\\/g, '/')}`;
}

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('is_token');
}

function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('is_refresh');
}

export function setSession(accessToken: string, refreshToken: string, user: unknown) {
  localStorage.setItem('is_token', accessToken);
  localStorage.setItem('is_refresh', refreshToken);
  localStorage.setItem('is_user', JSON.stringify(mergeStoredUser(user)));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('is-session-updated'));
  }
}

/** Keep avatar/org when login/refresh returns a thinner user payload. */
function mergeStoredUser(incoming: unknown): unknown {
  if (!incoming || typeof incoming !== 'object') return incoming;
  const prev = getUser<Record<string, unknown>>();
  if (!prev) return incoming;
  const next = { ...prev, ...(incoming as Record<string, unknown>) };
  for (const key of ['avatarUrl', 'avatarPath', 'organization'] as const) {
    const v = (incoming as Record<string, unknown>)[key];
    const blank = v == null || v === '' || (typeof v === 'object' && !Object.keys(v as object).length);
    if (blank && prev[key] != null && prev[key] !== '') next[key] = prev[key];
  }
  return next;
}

export function clearSession() {
  localStorage.removeItem('is_token');
  localStorage.removeItem('is_refresh');
  localStorage.removeItem('is_user');
}

export function getUser<T = any>(): T | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('is_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    clearSession();
    return null;
  }
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefreshToken();
  if (!refresh) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: refresh }),
        });
        const text = await res.text();
        let data: any = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch {
          data = {};
        }
        if (!res.ok) return null;
        setSession(data.accessToken, data.refreshToken, data.user);
        return data.accessToken as string;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname === '/login') return;
  window.location.href = '/login';
}

/** Turn Nest/Prisma noise into short UI copy; keep useful validation messages. */
function friendlyApiError(raw: unknown, status: number): string {
  const joined = Array.isArray(raw) ? raw.join(', ') : raw;
  const msg = typeof joined === 'string' ? joined.trim() : '';
  const lower = msg.toLowerCase();
  const technical =
    !msg ||
    lower === 'internal server error' ||
    lower.includes('prisma') ||
    lower.includes('invalid `') ||
    lower.includes('does not exist') ||
    lower.includes('unknown arg') ||
    lower.includes('column') ||
    /^error\b/.test(lower) ||
    msg.length > 220;

  if (status === 403) return technical ? 'You do not have permission for this action.' : msg;
  if (status === 404) return technical ? 'That item was not found.' : msg;
  if (status === 409) return technical ? 'This conflicts with existing data. Refresh and try again.' : msg;
  if (status === 429) return 'Too many requests. Please wait a moment and try again.';
  if (status >= 500) {
    return technical ? 'Something went wrong on the server. Please try again in a moment.' : msg;
  }
  if (technical) return `Request failed (${status}). Please try again.`;
  return msg;
}

export async function api<T = any>(path: string, opts: ApiOpts = {}): Promise<T> {
  const token = opts.token ?? getToken();
  const headers: Record<string, string> = {};
  if (!opts.form) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      method: opts.method || 'GET',
      headers,
      body: opts.form ? opts.form : opts.body ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error(
      'Unable to connect to Intellisoft. Please try again in a moment.',
    );
  }

  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (res.status === 401 && !path.includes('/auth/') && !opts._retry) {
    const nextToken = await refreshAccessToken();
    if (nextToken) {
      return api(path, { ...opts, token: nextToken, _retry: true });
    }
  }

  if (res.status === 401) {
    clearSession();
    if (!path.includes('/auth/login')) redirectToLogin();
    throw new Error(
      typeof data.message === 'string' && data.message && !/internal server error/i.test(data.message)
        ? data.message
        : 'Your session expired. Please sign in again.',
    );
  }

  if (!res.ok) {
    throw new Error(friendlyApiError(data.message, res.status));
  }

  return data as T;
}

export function money(n: number, currency = 'INR') {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(n || 0);
  } catch {
    return `${currency} ${(n || 0).toFixed(2)}`;
  }
}

export async function openAuthenticatedFile(path: string, fileName?: string, retry = true) {
  const token = getToken();
  const res = await fetch(`${API}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    if (retry) {
      const nextToken = await refreshAccessToken();
      if (nextToken) return openAuthenticatedFile(path, fileName, false);
    }
    clearSession();
    redirectToLogin();
    throw new Error('Sign in again to open this file.');
  }
  if (!res.ok) {
    throw new Error('Could not open the file.');
  }
  const blob = await res.blob();
  const type = blob.type || res.headers.get('content-type') || '';
  const url = URL.createObjectURL(blob);
  const preview = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/)/i.test(type);
  if (preview) {
    window.open(url, '_blank', 'noopener,noreferrer');
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
