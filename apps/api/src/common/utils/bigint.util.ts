import { BadRequestException } from '@nestjs/common';

export function parseBigIntId(v: unknown, field = 'id'): bigint {
  const s = String(v ?? '').trim();
  if (!/^\d+$/.test(s))
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  const n = BigInt(s);
  if (n <= 0n) throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  return n;
}

export function bigintToString(v: bigint | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v.toString();
}
