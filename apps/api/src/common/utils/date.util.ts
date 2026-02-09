import { BadRequestException } from '@nestjs/common';

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function toDateOnly(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function todayDateOnly(): string {
  return toDateOnly(new Date());
}

export function parseDateOnly(v: string, field = 'date'): Date {
  const s = String(v || '').trim();
  if (!DATE_ONLY_RE.test(s))
    throw new BadRequestException(`INVALID_${field.toUpperCase()}`);
  // date-only ustunlar uchun timezone siljimasin deb UTC 00:00 ishlatamiz
  return new Date(`${s}T00:00:00.000Z`);
}

export function parseDateOnlyOrNow(v?: string, field = 'date'): Date {
  const s = String(v || '').trim();
  if (!s) return new Date();
  return parseDateOnly(s, field);
}
