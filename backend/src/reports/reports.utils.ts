import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/** Join SQL fragments with a separator (avoids `$3AND` when placeholders abut keywords). */
export function joinSql(parts: Prisma.Sql[], separator = ' '): Prisma.Sql {
  const filtered = parts.filter((p) => p !== Prisma.empty);
  if (filtered.length === 0) {
    return Prisma.empty;
  }
  return Prisma.join(filtered, separator);
}

/** Tenant filters for Sale rows in raw SQL (client + branch + optional cashier/shift). */
export function saleFilterSql(
  clientId: string,
  branchId: string,
  cashierId?: string,
  shiftId?: string,
  saleAlias: 's' | 's2' = 's',
): Prisma.Sql {
  if (saleAlias === 's2') {
    return joinSql([
      Prisma.sql`AND s2."clientId" = ${clientId}`,
      Prisma.sql`AND s2."branchId" = ${branchId}`,
      ...(cashierId ? [Prisma.sql`AND s2."cashierId" = ${cashierId}`] : []),
      ...(shiftId ? [Prisma.sql`AND s2."shiftId" = ${shiftId}`] : []),
    ]);
  }
  return joinSql([
    Prisma.sql`AND s."clientId" = ${clientId}`,
    Prisma.sql`AND s."branchId" = ${branchId}`,
    ...(cashierId ? [Prisma.sql`AND s."cashierId" = ${cashierId}`] : []),
    ...(shiftId ? [Prisma.sql`AND s."shiftId" = ${shiftId}`] : []),
  ]);
}

/** Branch-scoped sale filter for dashboard best-sellers (`s` alias). */
export function branchSaleFilterSql(
  clientId: string,
  branchId: string,
  cashierId?: string,
): Prisma.Sql {
  return joinSql([
    Prisma.sql`AND s."clientId" = ${clientId}`,
    Prisma.sql`AND s."branchId" = ${branchId}`,
    ...(cashierId ? [Prisma.sql`AND s."cashierId" = ${cashierId}`] : []),
  ]);
}

export function dec(v: unknown): Prisma.Decimal {
  if (v == null) {
    return new Prisma.Decimal(0);
  }
  if (typeof v === 'object' && v !== null && 'toString' in v) {
    return new Prisma.Decimal((v as { toString: () => string }).toString());
  }
  return new Prisma.Decimal(String(v));
}

export function utcStartOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function utcEndOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
}

export function parseDateOnly(s: string, label: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException({ message: `Invalid ${label}`, code: 'INVALID_DATE' });
  }
  return d;
}

export function addUtcDays(d: Date, n: number): Date {
  const x = new Date(d.getTime());
  x.setUTCDate(x.getUTCDate() + n);
  return x;
}

export function formatUtcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}
