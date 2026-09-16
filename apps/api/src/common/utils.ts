import { existsSync } from 'fs';
import { join } from 'path';
import { Decimal } from '@prisma/client/runtime/library';

export function money(v: Decimal | number | string | null | undefined): number {
  if (v == null) return 0;
  return Number(v);
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function nextNumber(prefix: string, seq: number, year?: number): string {
  const y = year ?? new Date().getFullYear();
  return `${prefix}-${y}-${String(seq).padStart(4, '0')}`;
}

export function resolveUploadPath(filePath?: string | null) {
  if (!filePath) return null;
  const rel = filePath.replace(/\\/g, '/').replace(/^\//, '');
  const cwd = process.cwd();
  const candidates = [
    join(cwd, rel),
    join(cwd, 'apps', 'api', rel),
    join(cwd, '..', rel),
  ];
  return candidates.find((p) => existsSync(p)) || null;
}

const INLINE_MIME = /^(image\/(png|jpe?g|gif|webp)|application\/pdf|text\/(plain|csv).*)/i;

export function mimeFromName(name?: string | null, fallback = 'application/octet-stream') {
  const ext = (name || '').split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    txt: 'text/plain; charset=utf-8',
    csv: 'text/csv; charset=utf-8',
    json: 'application/json',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    zip: 'application/zip',
  };
  return (ext && map[ext]) || fallback;
}

export function isInlineFile(mime: string) {
  return INLINE_MIME.test(mime);
}

export function contentDisposition(fileName: string, inline: boolean) {
  const safe = fileName.replace(/[^\w.\- ()[\]]+/g, '_') || 'file';
  const encoded = encodeURIComponent(fileName);
  return `${inline ? 'inline' : 'attachment'}; filename="${safe}"; filename*=UTF-8''${encoded}`;
}

/** Absolute public URL for an upload path; upgrades same-host http→https when API is HTTPS. */
export function publicFileUrl(apiPublicUrl: string, filePath?: string | null) {
  if (!filePath) return null;
  const base = apiPublicUrl.replace(/\/$/, '');
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    try {
      const u = new URL(filePath);
      const b = new URL(base);
      if (u.hostname === b.hostname && b.protocol === 'https:' && u.protocol === 'http:') {
        u.protocol = 'https:';
        return u.toString();
      }
    } catch {
      /* keep original */
    }
    return filePath;
  }
  const rel = filePath.replace(/\\/g, '/').replace(/^\//, '');
  return `${base}/${rel}`;
}

export function splitGst(
  taxableAmount: number,
  taxPercent: number,
  supplierState: string,
  placeOfSupply: string,
) {
  const taxTotal = round2((taxableAmount * taxPercent) / 100);
  const sameState = (supplierState || '').trim().toLowerCase() === (placeOfSupply || '').trim().toLowerCase();
  if (sameState) {
    const half = round2(taxTotal / 2);
    return { cgst: half, sgst: round2(taxTotal - half), igst: 0, taxTotal };
  }
  return { cgst: 0, sgst: 0, igst: taxTotal, taxTotal };
}

export function invoiceStatusFromAmounts(
  amountDue: number,
  amountPaid: number,
  dueDate: Date | string,
  now = new Date(),
): 'PAID' | 'PARTIAL' | 'OVERDUE' | 'SENT' {
  if (amountDue <= 0.009) return 'PAID';
  if (amountPaid > 0) return 'PARTIAL';
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (due.getTime() < now.getTime()) return 'OVERDUE';
  return 'SENT';
}
