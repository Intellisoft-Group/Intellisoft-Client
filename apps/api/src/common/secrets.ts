import { Logger } from '@nestjs/common';

const log = new Logger('Secrets');

/** Resolve a secret; in production missing values abort boot / throw. */
export function requireSecret(
  name: string,
  value: string | undefined | null,
  options?: { allowDevFallback?: string; context?: string },
): string {
  const trimmed = (value || '').trim();
  if (trimmed) return trimmed;
  const prod = process.env.NODE_ENV === 'production';
  if (prod) {
    throw new Error(
      `${options?.context ? options.context + ': ' : ''}Missing required secret ${name} in production`,
    );
  }
  if (options?.allowDevFallback != null) {
    log.warn(`${name} unset — using insecure development fallback`);
    return options.allowDevFallback;
  }
  throw new Error(`Missing required configuration: ${name}`);
}

/** Fail fast at process start when production env is incomplete. */
export function assertProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'DATABASE_URL', 'API_PUBLIC_URL', 'CLIENT_APP_URL', 'CORS_ORIGINS'] as const;
  const missing = required.filter((k) => !(process.env[k] || '').trim());
  if (missing.length) {
    throw new Error(`Production boot blocked — set: ${missing.join(', ')}`);
  }
}
