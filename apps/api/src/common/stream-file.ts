import { createReadStream, statSync } from 'fs';
import { Response } from 'express';
import { contentDisposition, isInlineFile, mimeFromName } from './utils';

export function streamDiskFile(res: Response, disk: string, fileName: string, mimeType?: string | null) {
  const mime = mimeFromName(fileName, mimeType || 'application/octet-stream');
  const inline = isInlineFile(mime);
  const size = statSync(disk).size;
  res.setHeader('Content-Type', mime);
  res.setHeader('Content-Disposition', contentDisposition(fileName, inline));
  res.setHeader('Content-Length', String(size));
  res.setHeader('Cache-Control', 'private, max-age=30');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Accept-Ranges', 'bytes');
  createReadStream(disk).pipe(res);
}
