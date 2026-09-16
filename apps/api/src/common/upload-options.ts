import { BadRequestException } from '@nestjs/common';
import { extname } from 'path';

type FileFilterCb = (error: Error | null, acceptFile: boolean) => void;

function extOf(file: Express.Multer.File) {
  return extname(file.originalname || '').toLowerCase();
}

function reject(cb: FileFilterCb, message: string) {
  cb(new BadRequestException(message), false);
}

/** Images only (avatars / brand). */
export function imageFileFilter(_req: unknown, file: Express.Multer.File, cb: FileFilterCb) {
  const mime = (file.mimetype || '').toLowerCase();
  const ok = /^image\/(png|jpe?g|gif|webp)$/.test(mime) || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(extOf(file));
  if (!ok) return reject(cb, 'Only PNG, JPEG, GIF, or WebP images are accepted');
  cb(null, true);
}

/** Common document / ticket / chat attachments. */
export function attachmentFileFilter(_req: unknown, file: Express.Multer.File, cb: FileFilterCb) {
  const mime = (file.mimetype || '').toLowerCase();
  const ext = extOf(file);
  const allowedExt = [
    '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp',
    '.txt', '.csv', '.doc', '.docx', '.xls', '.xlsx',
    '.ppt', '.pptx', '.zip',
  ];
  const allowedMime =
    /^(application\/(pdf|zip|msword|vnd\.|octet-stream)|image\/(png|jpe?g|gif|webp)|text\/)/.test(mime) ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  if (!allowedExt.includes(ext) && !allowedMime) {
    return reject(cb, 'Allowed: PDF, images (PNG JPEG GIF WebP), Office, CSV, TXT, ZIP');
  }
  cb(null, true);
}

export const UPLOAD_LIMITS = {
  avatar: 2 * 1024 * 1024,
  document: 25 * 1024 * 1024,
  ticket: 15 * 1024 * 1024,
  chat: 20 * 1024 * 1024,
  invoicePdf: 20 * 1024 * 1024,
} as const;
