import { Injectable, NotFoundException } from '@nestjs/common';
import {
  BusinessType,
  PaymentMethod,
  RefundApprovalMethod,
  RefundSourceType,
  RefundStatus,
  RefundType,
  RestockAction,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export type RefundPrintItem = {
  lineNumber: number;
  itemName: string;
  sku: string | null;
  barcode: string | null;
  originalQuantity: number | null;
  refundedQuantity: number;
  unitPrice: string;
  taxRefunded: string;
  discountAdjusted: string;
  lineAmount: string;
  restockAction: RestockAction;
  restockQuantity: number;
  reason: string | null;
};

export type RefundPrintData = {
  title: string;
  subtitle: string;
  company: {
    businessName: string;
    storeName: string;
    branchName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    taxNumber: string | null;
    logoUrl: string | null;
  };
  customer: {
    name: string | null;
    companyName: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    taxNumber: string | null;
  } | null;
  refund: {
    id: string;
    refundNumber: string;
    refundType: RefundType;
    status: RefundStatus;
    sourceType: RefundSourceType;
    sourceTypeLabel: string;
    sourceNumber: string;
    reason: string;
    notes: string | null;
    createdAt: string;
    completedAt: string | null;
    paymentMethod: PaymentMethod | null;
    currency: string;
  };
  items: RefundPrintItem[];
  totals: {
    subtotalRefunded: string;
    taxRefunded: string;
    discountAdjusted: string;
    totalRefunded: string;
  };
  approval: {
    createdBy: string;
    approvedBy: string | null;
    approvalMethod: RefundApprovalMethod | null;
    approvalMethodLabel: string | null;
    approvalIdSnapshot: string | null;
    nfcUidMasked: string | null;
    approvedAt: string | null;
  };
  footerText: string | null;
};

const SOURCE_LABELS: Record<RefundSourceType, string> = {
  [RefundSourceType.RETAIL_SALE]: 'Retail Sale',
  [RefundSourceType.FNB_ORDER]: 'F&B Order',
  [RefundSourceType.WHOLESALE_INVOICE]: 'Wholesale Invoice',
};

const APPROVAL_LABELS: Record<RefundApprovalMethod, string> = {
  [RefundApprovalMethod.APPROVAL_ID]: 'Manager Approval ID',
  [RefundApprovalMethod.NFC_CARD]: 'NFC Card',
  [RefundApprovalMethod.NFC_CARD_AND_PIN]: 'NFC Card + PIN',
};

@Injectable()
export class RefundPrintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async getPrintData(clientId: string, refundId: string): Promise<RefundPrintData> {
    const refund = await this.prisma.refund.findFirst({
      where: { id: refundId, clientId },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        user: { select: { name: true, username: true } },
        approvedBy: { select: { name: true, username: true } },
        sale: {
          select: {
            invoiceNumber: true,
            customerId: true,
            branchId: true,
            items: { select: { id: true, quantity: true } },
          },
        },
        fnbOrder: {
          select: {
            orderNumber: true,
            customerId: true,
            branchId: true,
            items: { select: { id: true, quantity: true } },
          },
        },
      },
    });

    if (!refund) {
      throw new NotFoundException({ message: 'Refund not found', code: 'REFUND_NOT_FOUND' });
    }

    const settings = await this.settings.get(clientId);
    const branchId = refund.branchId ?? refund.sale?.branchId ?? refund.fnbOrder?.branchId;
    const company = await this.loadCompany(clientId, branchId);

    const customerId =
      refund.sale?.customerId ?? refund.fnbOrder?.customerId ?? null;
    const customer = customerId ? await this.loadCustomer(clientId, customerId) : null;

    const sourceNumber =
      refund.sale?.invoiceNumber ??
      refund.fnbOrder?.orderNumber ??
      refund.sourceId.slice(0, 8);

    const isWholesale =
      refund.sourceType === RefundSourceType.WHOLESALE_INVOICE ||
      refund.businessType === BusinessType.WHOLESALE;

    const originalQtyByItem = new Map<string, number>();
    if (refund.sale) {
      for (const si of refund.sale.items) originalQtyByItem.set(si.id, si.quantity);
    }
    if (refund.fnbOrder) {
      for (const oi of refund.fnbOrder.items) originalQtyByItem.set(oi.id, oi.quantity);
    }

    const items: RefundPrintItem[] = refund.items.map((line, idx) => ({
      lineNumber: idx + 1,
      itemName: line.itemNameSnapshot,
      sku: line.skuSnapshot,
      barcode: line.barcodeSnapshot,
      originalQuantity: originalQtyByItem.get(line.sourceItemId) ?? null,
      refundedQuantity: line.quantity,
      unitPrice: line.unitPriceSnapshot.toString(),
      taxRefunded: line.taxRefunded.toString(),
      discountAdjusted: line.discountAdjusted.toString(),
      lineAmount: line.amount.toString(),
      restockAction: line.restockAction,
      restockQuantity: line.restockQuantity,
      reason: line.reason,
    }));

    return {
      title: isWholesale ? 'Refund Receipt / Credit Note' : 'Refund Receipt',
      subtitle: 'This document is for reference only and does not change stock or payment records.',
      company,
      customer,
      refund: {
        id: refund.id,
        refundNumber: refund.refundNumber,
        refundType: refund.refundType,
        status: refund.status,
        sourceType: refund.sourceType,
        sourceTypeLabel: SOURCE_LABELS[refund.sourceType],
        sourceNumber,
        reason: refund.reason,
        notes: refund.notes,
        createdAt: refund.createdAt.toISOString(),
        completedAt: refund.completedAt?.toISOString() ?? null,
        paymentMethod: refund.paymentMethod,
        currency: settings.currency,
      },
      items,
      totals: {
        subtotalRefunded: refund.subtotal.toString(),
        taxRefunded: refund.taxRefunded.toString(),
        discountAdjusted: refund.discountAdjusted.toString(),
        totalRefunded: refund.totalRefunded.toString(),
      },
      approval: {
        createdBy: refund.user.name ?? refund.user.username,
        approvedBy: refund.approvedBy?.name ?? refund.approvedBy?.username ?? null,
        approvalMethod: refund.approvalMethod,
        approvalMethodLabel: refund.approvalMethod
          ? APPROVAL_LABELS[refund.approvalMethod]
          : null,
        approvalIdSnapshot: refund.approvedByApprovalIdCodeSnapshot,
        nfcUidMasked: refund.approvedByNfcUidMaskedSnapshot,
        approvedAt: refund.approvedAt?.toISOString() ?? null,
      },
      footerText: settings.receiptFooter,
    };
  }

  private async loadCompany(clientId: string, branchId: string | null | undefined) {
    const [client, branch, settings] = await Promise.all([
      this.prisma.client.findFirst({
        where: { id: clientId },
        select: { businessName: true, email: true, phone: true },
      }),
      branchId
        ? this.prisma.branch.findFirst({
            where: { id: branchId, clientId },
            select: { name: true, address: true, phone: true },
          })
        : Promise.resolve(null),
      this.settings.get(clientId),
    ]);

    return {
      businessName: client?.businessName ?? settings.storeName,
      storeName: settings.storeName,
      branchName: branch?.name ?? null,
      address: branch?.address ?? settings.storeAddress,
      phone: branch?.phone ?? settings.storePhone ?? client?.phone ?? null,
      email: client?.email ?? null,
      taxNumber: null,
      logoUrl: settings.receiptLogo,
    };
  }

  private async loadCustomer(clientId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, clientId },
      select: {
        name: true,
        companyName: true,
        phone: true,
        email: true,
        address: true,
        taxNumber: true,
      },
    });
    if (!customer) return null;
    return {
      name: customer.name,
      companyName: customer.companyName ?? customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      taxNumber: customer.taxNumber,
    };
  }
}
