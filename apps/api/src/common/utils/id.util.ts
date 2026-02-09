import { BadRequestException } from '@nestjs/common';

const BIGINT_RE = /^\d+$/;

export function parseBigIntId(value: unknown, field = 'id'): bigint {
  const s = String(value ?? '').trim();
  if (!s || !BIGINT_RE.test(s))
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  try {
    return BigInt(s);
  } catch {
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  }
}

export function toStrId(v: bigint | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v.toString();
}
