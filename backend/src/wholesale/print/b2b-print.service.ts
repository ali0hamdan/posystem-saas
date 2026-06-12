import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import { SafeUser } from '../../auth/types/safe-user.type';

type PrintCompany = {
  businessName: string;
  storeName: string;
  branchName: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxNumber: string | null;
  logoUrl: string | null;
};

type PrintCustomer = {
  name: string | null;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxNumber: string | null;
  paymentTermsDays: number | null;
};

type PrintItem = {
  lineNumber: number;
  productName: string;
  sku: string | null;
  barcode: string | null;
  quantity: number;
  unitPrice: string;
  discount: string;
  taxRate: string | null;
  lineTotal: string;
  notes: string | null;
};

type PrintPayment = {
  id: string;
  method: string;
  amount: string;
  createdAt: string;
};

export type B2bPrintData = {
  documentType: 'QUOTATION' | 'PROFORMA_INVOICE' | 'OFFICIAL_INVOICE';
  title: string;
  subtitle: string;
  company: PrintCompany;
  customer: PrintCustomer | null;
  document: {
    id: string;
    number: string;
    issueDate: string;
    validUntil: string | null;
    dueDate: string | null;
    status: string;
    createdBy: string | null;
    convertedStatus: string | null;
    sourceReference: string | null;
    paymentStatus: string | null;
    currency: string;
  };
  items: PrintItem[];
  totals: {
    subtotal: string;
    discountTotal: string;
    taxTotal: string;
    shippingFee: string | null;
    total: string;
    amountPaid: string | null;
    balanceDue: string | null;
  };
  payments: PrintPayment[] | null;
  terms: {
    terms: string | null;
    notes: string | null;
    defaultTerms: string | null;
    showSignatureArea: boolean;
    footerText: string | null;
  };
};

@Injectable()
export class B2bPrintService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async quotationPrintData(id: string, clientId: string): Promise<B2bPrintData> {
    const row = await this.prisma.quotation.findFirst({
      where: { id, clientId },
      include: {
        items: { orderBy: { productNameSnapshot: 'asc' } },
      },
    });
    if (!row) throw new NotFoundException({ message: 'Quotation not found', code: 'QUOTATION_NOT_FOUND' });

    const [company, customer, createdBy] = await Promise.all([
      this.loadCompany(clientId, row.branchId),
      this.loadCustomer(clientId, row.customerId),
      this.loadUserName(row.createdById),
    ]);
    const settings = await this.settings.get(clientId);

    let convertedStatus: string | null = null;
    if (row.status === 'CONVERTED_TO_INVOICE' || row.convertedToInvoiceId) {
      convertedStatus = 'Converted to official invoice';
    } else if (row.status === 'CONVERTED_TO_PROFORMA' || row.convertedToProformaId) {
      convertedStatus = 'Converted to proforma invoice';
    } else if (row.status === 'CANCELLED') {
      convertedStatus = 'Cancelled';
    } else if (row.status === 'REJECTED') {
      convertedStatus = 'Rejected';
    } else if (row.status === 'EXPIRED') {
      convertedStatus = 'Expired';
    }

    return {
      documentType: 'QUOTATION',
      title: 'QUOTATION',
      subtitle: 'Not an official invoice',
      company,
      customer,
      document: {
        id: row.id,
        number: row.quotationNumber,
        issueDate: row.createdAt.toISOString(),
        validUntil: row.validUntil?.toISOString() ?? null,
        dueDate: null,
        status: row.status,
        createdBy,
        convertedStatus,
        sourceReference: null,
        paymentStatus: null,
        currency: settings.currency,
      },
      items: this.mapQuotationItems(row.items),
      totals: this.mapTotals(row.subtotal, row.discountTotal, row.taxTotal, row.total),
      payments: null,
      terms: {
        terms: row.terms,
        notes: row.notes,
        defaultTerms: settings.quotationTerms,
        showSignatureArea: settings.showSignatureArea,
        footerText: settings.receiptFooter,
      },
    };
  }

  async proformaPrintData(id: string, clientId: string): Promise<B2bPrintData> {
    const row = await this.prisma.proformaInvoice.findFirst({
      where: { id, clientId },
      include: {
        items: { orderBy: { productNameSnapshot: 'asc' } },
      },
    });
    if (!row) {
      throw new NotFoundException({ message: 'Proforma invoice not found', code: 'PROFORMA_NOT_FOUND' });
    }

    const [company, customer, createdBy, sourceRef] = await Promise.all([
      this.loadCompany(clientId, row.branchId),
      this.loadCustomer(clientId, row.customerId),
      this.loadUserName(row.createdById),
      this.resolveProformaSource(clientId, row.quotationId),
    ]);
    const settings = await this.settings.get(clientId);

    let convertedStatus: string | null = null;
    if (row.status === 'CONVERTED_TO_INVOICE' || row.convertedToInvoiceId) {
      convertedStatus = 'Converted to official invoice';
    } else if (row.status === 'CANCELLED') {
      convertedStatus = 'Cancelled';
    }

    return {
      documentType: 'PROFORMA_INVOICE',
      title: 'PROFORMA INVOICE',
      subtitle: 'Not a tax invoice',
      company,
      customer,
      document: {
        id: row.id,
        number: row.proformaNumber,
        issueDate: row.createdAt.toISOString(),
        validUntil: row.validUntil?.toISOString() ?? null,
        dueDate: null,
        status: row.status,
        createdBy,
        convertedStatus,
        sourceReference: sourceRef,
        paymentStatus: null,
        currency: settings.currency,
      },
      items: this.mapProformaItems(row.items),
      totals: this.mapTotals(row.subtotal, row.discountTotal, row.taxTotal, row.total),
      payments: null,
      terms: {
        terms: row.terms,
        notes: row.notes,
        defaultTerms: settings.proformaTerms,
        showSignatureArea: settings.showSignatureArea,
        footerText: settings.receiptFooter,
      },
    };
  }

  async invoicePrintData(id: string, user: SafeUser, activeBranchId: string): Promise<B2bPrintData> {
    const sale = await this.prisma.sale.findFirst({
      where: { id, clientId: user.clientId },
      include: {
        items: {
          include: {
            product: { select: { name: true, sku: true, barcode: true } },
          },
          orderBy: { productId: 'asc' },
        },
        payments: { orderBy: { createdAt: 'asc' } },
        customer: {
          include: { creditProfile: true },
        },
        cashier: { select: { name: true, username: true } },
      },
    });
    if (!sale) throw new NotFoundException({ message: 'Invoice not found', code: 'SALE_NOT_FOUND' });

    this.assertSaleAccess(sale.cashierId, user);
    await this.assertSaleBranchAccess(user, sale.branchId, activeBranchId);

    const [company, sourceRef, settings] = await Promise.all([
      this.loadCompany(user.clientId, sale.branchId),
      this.resolveInvoiceSource(user.clientId, sale.sourceQuotationId, sale.sourceProformaId),
      this.settings.get(user.clientId),
    ]);

    const amountPaid = sale.payments.reduce(
      (sum, p) => sum.add(p.amount),
      new Prisma.Decimal(0),
    );
    const balanceDue = sale.total.minus(amountPaid);
    const paymentTermsDays = sale.customer?.creditProfile?.paymentTermsDays ?? settings.defaultPaymentTermsDays;
    const dueDate =
      sale.paymentStatus !== 'PAID' && paymentTermsDays > 0
        ? new Date(sale.createdAt.getTime() + paymentTermsDays * 86_400_000).toISOString()
        : null;

    const customer: PrintCustomer | null = sale.customer
      ? this.mapPrintCustomer(sale.customer, settings.defaultPaymentTermsDays)
      : null;

    return {
      documentType: 'OFFICIAL_INVOICE',
      title: 'OFFICIAL INVOICE',
      subtitle: 'Official Invoice',
      company,
      customer,
      document: {
        id: sale.id,
        number: sale.invoiceNumber,
        issueDate: sale.createdAt.toISOString(),
        validUntil: null,
        dueDate,
        status: sale.status,
        createdBy: sale.cashier?.name ?? sale.cashier?.username ?? null,
        convertedStatus: null,
        sourceReference: sourceRef,
        paymentStatus: sale.paymentStatus,
        currency: settings.currency,
      },
      items: sale.items.map((line, idx) => ({
        lineNumber: idx + 1,
        productName: line.product?.name ?? 'Item',
        sku: line.product?.sku ?? null,
        barcode: line.product?.barcode ?? null,
        quantity: line.quantity,
        unitPrice: line.unitPrice.toString(),
        discount: line.discount.toString(),
        taxRate: null,
        lineTotal: line.total.toString(),
        notes: null,
      })),
      totals: {
        ...this.mapTotals(sale.subtotal, sale.discountTotal, sale.taxTotal, sale.total),
        amountPaid: amountPaid.toString(),
        balanceDue: balanceDue.gt(0) ? balanceDue.toString() : '0',
      },
      payments: sale.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: p.amount.toString(),
        createdAt: p.createdAt.toISOString(),
      })),
      terms: {
        terms: null,
        notes: sale.couponCode ? `Coupon: ${sale.couponCode}` : null,
        defaultTerms: paymentTermsDays > 0 ? `Net ${paymentTermsDays}` : null,
        showSignatureArea: settings.showSignatureArea,
        footerText: settings.receiptFooter,
      },
    };
  }

  private mapTotals(
    subtotal: Prisma.Decimal,
    discountTotal: Prisma.Decimal,
    taxTotal: Prisma.Decimal,
    total: Prisma.Decimal,
  ) {
    return {
      subtotal: subtotal.toString(),
      discountTotal: discountTotal.toString(),
      taxTotal: taxTotal.toString(),
      shippingFee: null,
      total: total.toString(),
      amountPaid: null,
      balanceDue: null,
    };
  }

  private mapQuotationItems(
    items: {
      productNameSnapshot: string;
      skuSnapshot: string | null;
      barcodeSnapshot: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discount: Prisma.Decimal;
      taxRate: Prisma.Decimal | null;
      total: Prisma.Decimal;
      notes: string | null;
    }[],
  ): PrintItem[] {
    return items.map((line, idx) => ({
      lineNumber: idx + 1,
      productName: line.productNameSnapshot,
      sku: line.skuSnapshot,
      barcode: line.barcodeSnapshot,
      quantity: line.quantity,
      unitPrice: line.unitPrice.toString(),
      discount: line.discount.toString(),
      taxRate: line.taxRate?.toString() ?? null,
      lineTotal: line.total.toString(),
      notes: line.notes,
    }));
  }

  private mapProformaItems(
    items: {
      productNameSnapshot: string;
      skuSnapshot: string | null;
      barcodeSnapshot: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      discount: Prisma.Decimal;
      taxRate: Prisma.Decimal | null;
      total: Prisma.Decimal;
      notes: string | null;
    }[],
  ): PrintItem[] {
    return this.mapQuotationItems(items);
  }

  private async loadCompany(clientId: string, branchId: string): Promise<PrintCompany> {
    const [client, branch, settings] = await Promise.all([
      this.prisma.client.findFirst({
        where: { id: clientId },
        select: { businessName: true, email: true, phone: true },
      }),
      this.prisma.branch.findFirst({
        where: { id: branchId, clientId },
        select: { name: true, address: true, phone: true },
      }),
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

  private mapPrintCustomer(
    customer: {
      name: string;
      phone: string | null;
      email?: string | null;
      address?: string | null;
      companyName?: string | null;
      taxNumber?: string | null;
      creditProfile?: { paymentTermsDays: number } | null;
    },
    defaultTerms?: number,
  ): PrintCustomer {
    return {
      name: customer.name,
      companyName: customer.companyName ?? customer.name,
      phone: customer.phone,
      email: customer.email ?? null,
      address: customer.address ?? null,
      taxNumber: customer.taxNumber ?? null,
      paymentTermsDays:
        customer.creditProfile?.paymentTermsDays ??
        (defaultTerms && defaultTerms > 0 ? defaultTerms : null),
    };
  }

  private async loadCustomer(clientId: string, customerId: string | null): Promise<PrintCustomer | null> {
    if (!customerId) return null;
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, clientId },
      include: { creditProfile: true },
    });
    if (!customer) return null;
    return this.mapPrintCustomer(customer);
  }

  private async loadUserName(userId: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      select: { name: true, username: true },
    });
    return user?.name ?? user?.username ?? null;
  }

  private async resolveProformaSource(clientId: string, quotationId: string | null): Promise<string | null> {
    if (!quotationId) return null;
    const q = await this.prisma.quotation.findFirst({
      where: { id: quotationId, clientId },
      select: { quotationNumber: true },
    });
    return q ? `Based on Quotation ${q.quotationNumber}` : null;
  }

  private async resolveInvoiceSource(
    clientId: string,
    sourceQuotationId: string | null,
    sourceProformaId: string | null,
  ): Promise<string | null> {
    if (sourceProformaId) {
      const p = await this.prisma.proformaInvoice.findFirst({
        where: { id: sourceProformaId, clientId },
        select: { proformaNumber: true },
      });
      if (p) return `Based on Proforma ${p.proformaNumber}`;
    }
    if (sourceQuotationId) {
      const q = await this.prisma.quotation.findFirst({
        where: { id: sourceQuotationId, clientId },
        select: { quotationNumber: true },
      });
      if (q) return `Based on Quotation ${q.quotationNumber}`;
    }
    return null;
  }

  private assertSaleAccess(saleCashierId: string, user: SafeUser): void {
    if (user.role === UserRole.CASHIER && saleCashierId !== user.id) {
      throw new ForbiddenException({
        message: 'You can only view your own sales',
        code: 'SALE_ACCESS_DENIED',
      });
    }
  }

  private async assertSaleBranchAccess(
    user: SafeUser,
    saleBranchId: string,
    activeBranchId: string,
  ): Promise<void> {
    if (user.role === UserRole.OWNER) return;
    if (saleBranchId !== activeBranchId) {
      throw new ForbiddenException({
        message: 'This sale belongs to a different branch',
        code: 'SALE_BRANCH_MISMATCH',
      });
    }
    const link = await this.prisma.userBranch.findFirst({
      where: { userId: user.id, branchId: saleBranchId },
      select: { userId: true },
    });
    if (!link) {
      throw new ForbiddenException({
        message: 'You do not have access to this branch',
        code: 'BRANCH_ACCESS_DENIED',
      });
    }
  }
}
