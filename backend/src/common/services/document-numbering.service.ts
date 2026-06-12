import { Injectable } from '@nestjs/common';
import { DocumentCounterType, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type TxClient = Prisma.TransactionClient | PrismaService;

/**
 * Atomic per-tenant document number generator.
 *
 * One `DocumentCounter` row per (clientId, docType). The PostgreSQL `UPDATE ...
 * increment` semantics give us row-level locking inside a transaction, so two
 * concurrent calls can't pull the same number.
 *
 * Prefer to call inside a `prisma.$transaction(async (tx) => ...)` callback so
 * the counter bump is committed atomically with the document insert.
 */
@Injectable()
export class DocumentNumberingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reserves the next sequence number for the given (clientId, docType).
   * Returns the formatted string using `prefix` (e.g. "Q-000007").
   */
  async nextNumber(
    clientId: string,
    docType: DocumentCounterType,
    prefix: string,
    db: TxClient = this.prisma,
  ): Promise<string> {
    const row = await db.documentCounter.upsert({
      where: { clientId_docType: { clientId, docType } },
      update: { lastNumber: { increment: 1 } },
      create: { clientId, docType, lastNumber: 1 },
      select: { lastNumber: true },
    });
    const padded = String(row.lastNumber).padStart(6, '0');
    const cleanPrefix = (prefix || '').trim().replace(/[^A-Za-z0-9-]/g, '').slice(0, 8) || docTypeFallback(docType);
    return `${cleanPrefix}-${padded}`;
  }
}

function docTypeFallback(docType: DocumentCounterType): string {
  switch (docType) {
    case 'QUOTATION':
      return 'Q';
    case 'PROFORMA_INVOICE':
      return 'PI';
    case 'SALE_INVOICE':
      return 'INV';
    case 'DELIVERY_NOTE':
      return 'DN';
    case 'REFUND':
      return 'RF';
  }
}
