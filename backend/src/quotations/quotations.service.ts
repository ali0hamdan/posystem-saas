import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PaymentStatus, QuotationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DocumentNumberingService } from '../common/services/document-numbering.service';
import { SettingsService } from '../settings/settings.service';
import { SalesService } from '../sales/sales.service';
import { SalesCommissionService } from '../commissions/sales-commission.service';
import { WholesalePricingService } from '../wholesale/bulk-pricing/wholesale-pricing.service';
import { NotificationService } from '../notifications/notification.service';
import { SafeUser } from '../auth/types/safe-user.type';
import {
  ConvertQuotationToInvoiceDto,
  CreateQuotationDto,
  ListQuotationsQueryDto,
  QuotationItemInputDto,
  UpdateQuotationDto,
} from './dto/quotation.dto';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const D0 = () => new Prisma.Decimal(0);

// Statuses where the document is no longer mutable.
const FROZEN_STATUSES: ReadonlySet<QuotationStatus> = new Set([
  QuotationStatus.CONVERTED_TO_PROFORMA,
  QuotationStatus.CONVERTED_TO_INVOICE,
  QuotationStatus.CANCELLED,
  QuotationStatus.EXPIRED,
  QuotationStatus.REJECTED,
]);

type ComputedItem = {
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  barcodeSnapshot: string | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  discount: Prisma.Decimal;
  taxRate: Prisma.Decimal | null;
  total: Prisma.Decimal;
  notes: string | null;
};

type Totals = {
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
  items: ComputedItem[];
};

@Injectable()
export class QuotationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly numbering: DocumentNumberingService,
    private readonly settings: SettingsService,
    private readonly sales: SalesService,
    private readonly commissions: SalesCommissionService,
    private readonly wholesalePricing: WholesalePricingService,
    private readonly notifications: NotificationService,
  ) {}

  // ---------- helpers ----------

  private async assertBranch(clientId: string, branchId?: string): Promise<string> {
    if (!branchId) {
      throw new BadRequestException({ message: 'X-Branch-Id header is required', code: 'BRANCH_REQUIRED' });
    }
    const b = await this.prisma.branch.findFirst({
      where: { id: branchId, clientId, isActive: true },
      select: { id: true },
    });
    if (!b) throw new BadRequestException({ message: 'Invalid branch', code: 'INVALID_BRANCH' });
    return branchId;
  }

  private async assertCustomer(clientId: string, customerId: string | null | undefined): Promise<void> {
    if (!customerId) return;
    const exists = await this.prisma.customer.findFirst({
      where: { id: customerId, clientId },
      select: { id: true },
    });
    if (!exists) throw new BadRequestException({ message: 'Customer not found', code: 'CUSTOMER_NOT_FOUND' });
  }

  private async computeTotals(
    clientId: string,
    items: QuotationItemInputDto[],
    customerId?: string | null,
  ): Promise<Totals> {
    if (!items?.length) {
      throw new BadRequestException({ message: 'items must not be empty', code: 'ITEMS_REQUIRED' });
    }
    const productIds = [...new Set(items.map((i) => i.productId))];
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, clientId },
      select: { id: true, name: true, sku: true, barcode: true, sellingPrice: true, isActive: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException({ message: 'One or more products were not found', code: 'PRODUCT_NOT_FOUND' });
    }
    const pmap = new Map(products.map((p) => [p.id, p]));

    let subtotal = D0();
    let discountTotal = D0();
    let taxTotal = D0();
    const computed: ComputedItem[] = [];
    for (const line of items) {
      const p = pmap.get(line.productId)!;
      if (!p.isActive) {
        throw new BadRequestException({ message: `Product inactive: ${p.name}`, code: 'PRODUCT_INACTIVE' });
      }
      let unit: Prisma.Decimal;
      if (line.unitPrice != null) {
        unit = D(line.unitPrice);
      } else {
        const resolved = await this.wholesalePricing.resolveWholesalePrice({
          clientId,
          customerId: customerId ?? null,
          productId: line.productId,
          quantity: line.quantity,
        });
        unit = D(resolved.finalUnitPrice);
      }
      const gross = unit.mul(line.quantity);
      const rawDisc = D(line.discount ?? 0);
      const discount = rawDisc.lte(gross) ? rawDisc : gross;
      const taxRate = line.taxRate != null ? D(line.taxRate) : null;
      const baseAfterDiscount = gross.sub(discount);
      const lineTax = taxRate ? D(baseAfterDiscount.mul(taxRate).div(100).toFixed(2)) : D0();
      const lineTotal = baseAfterDiscount.add(lineTax);

      subtotal = subtotal.add(gross);
      discountTotal = discountTotal.add(discount);
      taxTotal = taxTotal.add(lineTax);

      computed.push({
        productId: p.id,
        productNameSnapshot: p.name,
        skuSnapshot: p.sku ?? null,
        barcodeSnapshot: p.barcode ?? null,
        quantity: line.quantity,
        unitPrice: unit,
        discount,
        taxRate,
        total: lineTotal,
        notes: line.notes?.trim() || null,
      });
    }

    const total = subtotal.sub(discountTotal).add(taxTotal);
    return { subtotal, discountTotal, taxTotal, total, items: computed };
  }

  private quotationInclude() {
    return {
      items: { orderBy: { productNameSnapshot: 'asc' as const } },
    } satisfies Prisma.QuotationInclude;
  }

  // ---------- CRUD ----------

  async list(clientId: string, branchId: string | undefined, q: ListQuotationsQueryDto) {
    const bid = await this.assertBranch(clientId, branchId);
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 50, 200);

    const where: Prisma.QuotationWhereInput = {
      clientId,
      branchId: bid,
      ...(q.status ? { status: q.status } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.q
        ? {
            OR: [
              { quotationNumber: { contains: q.q, mode: 'insensitive' } },
              { notes: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.quotation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: this.quotationInclude(),
      }),
      this.prisma.quotation.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async get(id: string, clientId: string) {
    const row = await this.prisma.quotation.findFirst({
      where: { id, clientId },
      include: this.quotationInclude(),
    });
    if (!row) throw new NotFoundException({ message: 'Quotation not found', code: 'QUOTATION_NOT_FOUND' });
    return row;
  }

  async create(dto: CreateQuotationDto, user: SafeUser, branchId?: string) {
    const bid = await this.assertBranch(user.clientId, branchId);
    await this.assertCustomer(user.clientId, dto.customerId);

    const settings = await this.settings.get(user.clientId);
    const validUntil =
      dto.validUntil
        ? new Date(dto.validUntil)
        : settings?.quotationValidityDays
        ? new Date(Date.now() + settings.quotationValidityDays * 86_400_000)
        : null;

    const totals = await this.computeTotals(user.clientId, dto.items, dto.customerId);

    const created = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.nextNumber(
        user.clientId,
        'QUOTATION',
        settings?.quotationPrefix ?? 'Q',
        tx,
      );
      return tx.quotation.create({
        data: {
          clientId: user.clientId,
          branchId: bid,
          customerId: dto.customerId ?? null,
          quotationNumber: number,
          status: QuotationStatus.DRAFT,
          validUntil,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          notes: dto.notes?.trim() || null,
          terms: dto.terms?.trim() || settings?.quotationTerms || null,
          createdById: user.id,
          items: { create: totals.items.map((i) => ({ ...i, clientId: user.clientId })) },
        },
        include: this.quotationInclude(),
      });
    });

    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'quotations.create',
      entity: 'Quotation',
      entityId: created.id,
      newValue: { quotationNumber: created.quotationNumber, total: created.total.toString() },
    });

    return created;
  }

  async update(id: string, dto: UpdateQuotationDto, user: SafeUser) {
    const existing = await this.get(id, user.clientId);
    if (FROZEN_STATUSES.has(existing.status)) {
      throw new ConflictException({
        message: `Quotation cannot be edited in status ${existing.status}`,
        code: 'QUOTATION_FROZEN',
      });
    }
    if (dto.customerId !== undefined) await this.assertCustomer(user.clientId, dto.customerId);

    const totals = dto.items
      ? await this.computeTotals(user.clientId, dto.items, dto.customerId ?? existing.customerId)
      : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (totals) {
        await tx.quotationItem.deleteMany({ where: { quotationId: id } });
        await tx.quotationItem.createMany({
          data: totals.items.map((i) => ({
            clientId: user.clientId,
            quotationId: id,
            productId: i.productId,
            productNameSnapshot: i.productNameSnapshot,
            skuSnapshot: i.skuSnapshot,
            barcodeSnapshot: i.barcodeSnapshot,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            discount: i.discount,
            taxRate: i.taxRate,
            total: i.total,
            notes: i.notes,
          })),
        });
      }

      const data: Prisma.QuotationUpdateInput = {
        ...(dto.customerId !== undefined ? { customerId: dto.customerId ?? null } : {}),
        ...(dto.validUntil !== undefined ? { validUntil: dto.validUntil ? new Date(dto.validUntil) : null } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes?.trim() || null } : {}),
        ...(dto.terms !== undefined ? { terms: dto.terms?.trim() || null } : {}),
        ...(totals
          ? {
              subtotal: totals.subtotal,
              discountTotal: totals.discountTotal,
              taxTotal: totals.taxTotal,
              total: totals.total,
            }
          : {}),
      };

      return tx.quotation.update({
        where: { id },
        data,
        include: this.quotationInclude(),
      });
    });

    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'quotations.update',
      entity: 'Quotation',
      entityId: id,
      newValue: { total: updated.total.toString(), status: updated.status },
    });

    return updated;
  }

  async setStatus(id: string, status: QuotationStatus, user: SafeUser) {
    const existing = await this.get(id, user.clientId);
    if (FROZEN_STATUSES.has(existing.status) && existing.status !== status) {
      throw new ConflictException({
        message: `Quotation status cannot move out of ${existing.status}`,
        code: 'QUOTATION_FROZEN',
      });
    }
    // Conversion statuses are owned by the conversion endpoints — don't allow manual setting.
    if (
      status === QuotationStatus.CONVERTED_TO_PROFORMA ||
      status === QuotationStatus.CONVERTED_TO_INVOICE
    ) {
      throw new BadRequestException({
        message: 'Use the conversion endpoints to convert a quotation',
        code: 'QUOTATION_USE_CONVERSION_ENDPOINT',
      });
    }
    const updated = await this.prisma.quotation.update({
      where: { id },
      data: { status },
      include: this.quotationInclude(),
    });
    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'quotations.status',
      entity: 'Quotation',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status },
    });

    if (status === QuotationStatus.ACCEPTED && existing.status !== QuotationStatus.ACCEPTED) {
      void this.notifications
        .notifyQuotationAccepted({
          clientId: user.clientId,
          quotationNumber: updated.quotationNumber,
          total: updated.total.toString(),
        })
        .catch(() => undefined);
    }

    return updated;
  }

  async cancel(id: string, user: SafeUser) {
    return this.setStatus(id, QuotationStatus.CANCELLED, user);
  }

  async accept(id: string, user: SafeUser) {
    return this.setStatus(id, QuotationStatus.ACCEPTED, user);
  }

  async reject(id: string, user: SafeUser) {
    return this.setStatus(id, QuotationStatus.REJECTED, user);
  }

  // ---------- conversions ----------

  /** Quotation → Proforma. Copies items + customer + totals. No stock touched. */
  async convertToProforma(id: string, user: SafeUser) {
    const existing = await this.get(id, user.clientId);
    if (FROZEN_STATUSES.has(existing.status)) {
      throw new ConflictException({
        message: `Quotation cannot be converted in status ${existing.status}`,
        code: 'QUOTATION_FROZEN',
      });
    }
    if (existing.convertedToProformaId) {
      throw new ConflictException({
        message: 'Quotation already converted to a proforma',
        code: 'ALREADY_CONVERTED',
      });
    }

    const settings = await this.settings.get(user.clientId);
    const validUntil = settings?.proformaValidityDays
      ? new Date(Date.now() + settings.proformaValidityDays * 86_400_000)
      : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.nextNumber(
        user.clientId,
        'PROFORMA_INVOICE',
        settings?.proformaPrefix ?? 'PI',
        tx,
      );
      const proforma = await tx.proformaInvoice.create({
        data: {
          clientId: user.clientId,
          branchId: existing.branchId,
          customerId: existing.customerId,
          quotationId: existing.id,
          proformaNumber: number,
          status: 'DRAFT',
          validUntil,
          subtotal: existing.subtotal,
          discountTotal: existing.discountTotal,
          taxTotal: existing.taxTotal,
          total: existing.total,
          notes: existing.notes,
          terms: existing.terms ?? settings?.proformaTerms ?? null,
          reserveStock: false,
          createdById: user.id,
          items: {
            create: existing.items.map((i) => ({
              clientId: user.clientId,
              productId: i.productId,
              productNameSnapshot: i.productNameSnapshot,
              skuSnapshot: i.skuSnapshot,
              barcodeSnapshot: i.barcodeSnapshot,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              discount: i.discount,
              taxRate: i.taxRate,
              total: i.total,
              notes: i.notes,
            })),
          },
        },
      });
      await tx.quotation.update({
        where: { id: existing.id },
        data: {
          status: QuotationStatus.CONVERTED_TO_PROFORMA,
          convertedToProformaId: proforma.id,
        },
      });
      return proforma;
    });

    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'quotations.convert_to_proforma',
      entity: 'Quotation',
      entityId: existing.id,
      newValue: { proformaId: result.id, proformaNumber: result.proformaNumber },
    });

    return result;
  }

  /** Quotation → Official Sale. Reuses SalesService.create (stock + ledger + invoice). */
  async convertToInvoice(id: string, dto: ConvertQuotationToInvoiceDto, user: SafeUser, branchId?: string) {
    const bid = await this.assertBranch(user.clientId, branchId);
    const existing = await this.get(id, user.clientId);
    if (FROZEN_STATUSES.has(existing.status)) {
      throw new ConflictException({
        message: `Quotation cannot be converted in status ${existing.status}`,
        code: 'QUOTATION_FROZEN',
      });
    }
    if (existing.branchId !== bid) {
      throw new ForbiddenException({
        message: 'You must convert this quotation from the branch that owns it',
        code: 'BRANCH_MISMATCH',
      });
    }

    const sale = await this.sales.create(
      {
        customerId: existing.customerId ?? undefined,
        items: existing.items.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          discount: i.discount ? Number(i.discount.toString()) : 0,
        })),
        payments: dto.payments,
        couponCode: dto.couponCode,
        salesmanId: dto.salesmanId,
        salesmanIdCode: dto.salesmanIdCode,
      },
      user,
      bid,
      user.clientId,
    );

    // Persist linkage. Two separate transactions is acceptable here because
    // a duplicate-conversion attempt is blocked by the status check above.
    await this.prisma.sale.update({
      where: { id: sale.id },
      data: { sourceQuotationId: existing.id },
    });
    await this.prisma.quotation.update({
      where: { id: existing.id },
      data: {
        status: QuotationStatus.CONVERTED_TO_INVOICE,
        convertedToInvoiceId: sale.id,
      },
    });

    if (sale.paymentStatus === PaymentStatus.PAID) {
      await this.commissions.calculateCommissionForSale(sale.id, user.clientId);
    }

    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'quotations.convert_to_invoice',
      entity: 'Quotation',
      entityId: existing.id,
      newValue: { saleId: sale.id, invoiceNumber: sale.invoiceNumber },
    });

    return { quotationId: existing.id, sale };
  }
}
