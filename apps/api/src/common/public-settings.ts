import { publicFileUrl } from './utils';

/** Fields safe to expose on public / client bootstrap surfaces (no bank/PAN/GSTIN). */
export function toPublicSettings<T extends Record<string, any> | null | undefined>(settings: T) {
  if (!settings) return null;
  const api = (process.env.API_PUBLIC_URL || '').replace(/\/$/, '');
  return {
    id: settings.id,
    companyName: settings.companyName,
    logoUrl: publicFileUrl(api || 'http://localhost:3000', settings.logoUrl) || settings.logoUrl || null,
    primaryColor: settings.primaryColor,
    splashCopy: settings.splashCopy,
    maintenanceMode: settings.maintenanceMode,
    minAppVersion: settings.minAppVersion,
    chargesTax: !!settings.chargesTax,
    defaultTaxPercent: Number(settings.defaultTaxPercent ?? 18),
  };
}
