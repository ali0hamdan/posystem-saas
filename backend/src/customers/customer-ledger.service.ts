import { Injectable, NotFoundException } from '@nestjs/common';
import { CustomerLedgerType, Prisma } from '@prisma/client';

export type AppendLedgerParams = {
  clientId: string;
  customerId: string;
  type: CustomerLedgerType;
  /** Signed delta: positive increases amount owed (AR), negative decreases */
  amount: Prisma.Decimal;
  referenceType?: string | null;
  referenceId?: string | null;
  note?: string | null;
  receiptNumber?: string | null;
  createdById: string;
};

@Injectable()
export class CustomerLedgerService {
  /**
   * Atomically updates `Customer.balance` and inserts `CustomerLedger`.
   * Must be called inside a transaction client `tx`.
   */
  async appendEntry(tx: Prisma.TransactionClient, params: AppendLedgerParams): Promise<void> {
    const row = await tx.customer.findFirst({
      where: { id: params.customerId, clientId: params.clientId },
      select: { balance: true },
    });
    if (!row) {
      throw new NotFoundException({
        message: 'Customer not found',
        code: 'CUSTOMER_NOT_FOUND',
      });
    }
    const before = new Prisma.Decimal(row.balance.toString());
    const after = before.add(params.amount);
    await tx.customer.update({
      where: { id: params.customerId },
      data: { balance: after },
    });
    await tx.customerLedger.create({
      data: {
        clientId: params.clientId,
        customerId: params.customerId,
        type: params.type,
        amount: params.amount,
        balanceAfter: after,
        referenceType: params.referenceType?.trim().slice(0, 64) || null,
        referenceId: params.referenceId?.trim().slice(0, 64) || null,
        note: params.note?.trim() || null,
        receiptNumber: params.receiptNumber?.trim().slice(0, 64) || null,
        createdById: params.createdById,
      },
    });
  }
}
