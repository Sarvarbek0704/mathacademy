import { BadRequestException } from '@nestjs/common';
import { createWriteStream, existsSync } from 'fs';
import { mkdirSync } from 'fs';
import { unlink } from 'fs/promises';
import { randomUUID } from 'crypto';
import { extname, join, resolve } from 'path';

export type StorageSaveResult = {
  provider: 'LOCAL';
  url: string; // public url, e.g. /uploads/...
  storagePath: string; // absolute or relative path on disk
  fileName: string; // stored file name (generated)
};

const DEFAULT_ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
]);

export function getUploadRoot(): string {
  return resolve(process.env.UPLOAD_DIR || 'uploads');
}

export function getMaxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB || 25);
  const safeMb = Number.isFinite(mb) && mb > 0 ? mb : 25;
  return Math.floor(safeMb * 1024 * 1024);
}

function safeSegment(v: string): string {
  return String(v || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 64);
}

export function assertAllowedMime(mime?: string) {
  const m = String(mime || '').trim().toLowerCase();
  if (!m) return;
  const allowed = (process.env.ALLOWED_UPLOAD_MIME || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  const set = allowed.length ? new Set(allowed) : DEFAULT_ALLOWED_MIME;
  if (!set.has(m)) throw new BadRequestException('UNSUPPORTED_FILE_TYPE');
}

export function buildTenantDir(tenantId: string): string {
  const root = getUploadRoot();
  const t = safeSegment(`tenant_${tenantId}`);
  const dir = join(root, t);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export async function saveLocalFile(args: {
  tenantId: string;
  ownerType: string;
  ownerId?: string | null;
  purpose?: string | null;
  originalName: string;
  mimeType?: string;
  buffer: Buffer;
}): Promise<StorageSaveResult> {
  const max = getMaxUploadBytes();
  if (args.buffer.length > max) throw new BadRequestException('FILE_TOO_LARGE');

  assertAllowedMime(args.mimeType);

  const baseDir = buildTenantDir(args.tenantId);
  const sub = join(
    baseDir,
    safeSegment(args.ownerType),
    args.ownerId ? safeSegment(String(args.ownerId)) : 'no_owner',
    args.purpose ? safeSegment(String(args.purpose)) : 'general',
  );
  if (!existsSync(sub)) mkdirSync(sub, { recursive: true });

  // Keep extension from original name (or from mime if needed)
  const ext = extname(args.originalName || '').slice(0, 10);
  const stored = `${Date.now()}_${randomUUID()}${ext || ''}`;

  const diskPath = join(sub, stored);
  await new Promise<void>((resolvePromise, rejectPromise) => {
    const stream = createWriteStream(diskPath, { flags: 'wx' });
    stream.on('error', rejectPromise);
    stream.on('finish', () => resolvePromise());
    stream.end(args.buffer);
  });

  // public url relative to /uploads
  const root = getUploadRoot();
  const rel = diskPath.replace(root, '').split('\\').join('/');
  const url = `/uploads${rel.startsWith('/') ? '' : '/'}${rel}`;

  return { provider: 'LOCAL', url, storagePath: diskPath, fileName: stored };
}

export async function safeDeleteLocalFile(storagePath?: string | null) {
  const p = String(storagePath || '').trim();
  if (!p) return;
  try {
    await unlink(p);
  } catch {
    // ignore
  }
}
