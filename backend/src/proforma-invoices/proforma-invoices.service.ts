import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PaymentStatus,
  ProformaInvoiceStatus,
  QuotationStatus,
  StockReservationSource,
  StockReservationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { DocumentNumberingService } from '../common/services/document-numbering.service';
import { SettingsService } from '../settings/settings.service';
import { SalesService } from '../sales/sales.service';
import { SalesCommissionService } from '../commissions/sales-commission.service';
import { WholesalePricingService } from '../wholesale/bulk-pricing/wholesale-pricing.service';
import { SafeUser } from '../auth/types/safe-user.type';
import {
  ConvertProformaToInvoiceDto,
  CreateProformaDto,
  ListProformaQueryDto,
  ProformaItemInputDto,
  UpdateProformaDto,
} from './dto/proforma.dto';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const D0 = () => new Prisma.Decimal(0);

const FROZEN_STATUSES: ReadonlySet<ProformaInvoiceStatus> = new Set([
  ProformaInvoiceStatus.CANCELLED,
  ProformaInvoiceStatus.CONVERTED_TO_INVOICE,
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
export class ProformaInvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly numbering: DocumentNumberingService,
    private readonly settings: SettingsService,
    private readonly sales: SalesService,
    private readonly commissions: SalesCommissionService,
    private readonly wholesalePricing: WholesalePricingService,
  ) {}

  // ---------- helpers ----------

  private async assertBranch(clientId: string, branchId?: string): Promise<string> {
    if (!branchId) throw new BadRequestException({ message: 'X-Branch-Id header is required', code: 'BRANCH_REQUIRED' });
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
    items: ProformaItemInputDto[],
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

    return { subtotal, discountTotal, taxTotal, total: subtotal.sub(discountTotal).add(taxTotal), items: computed };
  }

  private proformaInclude() {
    return {
      items: { orderBy: { productNameSnapshot: 'asc' as const } },
    } satisfies Prisma.ProformaInvoiceInclude;
  }

  private async assertReservationFeatureEnabled(clientId: string): Promise<void> {
    const settings = await this.settings.get(clientId);
    if (!settings.enableStockReservation) {
      throw new ForbiddenException({
        message: 'Stock reservation is disabled in store settings',
        code: 'RESERVATION_DISABLED',
      });
    }
  }

  // ---------- CRUD ----------

  async list(clientId: string, branchId: string | undefined, q: ListProformaQueryDto) {
    const bid = await this.assertBranch(clientId, branchId);
    const page = q.page ?? 1;
    const limit = Math.min(q.limit ?? 50, 200);

    const where: Prisma.ProformaInvoiceWhereInput = {
      clientId,
      branchId: bid,
      ...(q.status ? { status: q.status } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.q
        ? {
            OR: [
              { proformaNumber: { contains: q.q, mode: 'insensitive' } },
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
      this.prisma.proformaInvoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: this.proformaInclude(),
      }),
      this.prisma.proformaInvoice.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async get(id: string, clientId: string) {
    const row = await this.prisma.proformaInvoice.findFirst({
      where: { id, clientId },
      include: this.proformaInclude(),
    });
    if (!row) throw new NotFoundException({ message: 'Proforma invoice not found', code: 'PROFORMA_NOT_FOUND' });
    return row;
  }

  async create(dto: CreateProformaDto, user: SafeUser, branchId?: string) {
    const bid = await this.assertBranch(user.clientId, branchId);
    await this.assertCustomer(user.clientId, dto.customerId);
    if (dto.quotationId) {
      const q = await this.prisma.quotation.findFirst({
        where: { id: dto.quotationId, clientId: user.clientId },
        select: { id: true },
      });
      if (!q) throw new BadRequestException({ message: 'Quotation not found', code: 'QUOTATION_NOT_FOUND' });
    }

    const settings = await this.settings.get(user.clientId);
    if (dto.reserveStock && !settings.enableStockReservation) {
      throw new ForbiddenException({
        message: 'Stock reservation is disabled in store settings',
        code: 'RESERVATION_DISABLED',
      });
    }

    const validUntil =
      dto.validUntil
        ? new Date(dto.validUntil)
        : settings.proformaValidityDays
        ? new Date(Date.now() + settings.proformaValidityDays * 86_400_000)
        : null;

    const totals = await this.computeTotals(user.clientId, dto.items, dto.customerId);

    const created = await this.prisma.$transaction(async (tx) => {
      const number = await this.numbering.nextNumber(
        user.clientId,
        'PROFORMA_INVOICE',
        settings.proformaPrefix,
        tx,
      );
      return tx.proformaInvoice.create({
        data: {
          clientId: user.clientId,
          branchId: bid,
          customerId: dto.customerId ?? null,
          quotationId: dto.quotationId ?? null,
          proformaNumber: number,
          status: ProformaInvoiceStatus.DRAFT,
          validUntil,
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
          notes: dto.notes?.trim() || null,
          terms: dto.terms?.trim() || settings.proformaTerms || null,
          reserveStock: dto.reserveStock ?? false,
          createdById: user.id,
          items: { create: totals.items.map((i) => ({ ...i, clientId: user.clientId })) },
        },
        include: this.proformaInclude(),
      });
    });

    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'proforma.create',
      entity: 'ProformaInvoice',
      entityId: created.id,
      newValue: { proformaNumber: created.proformaNumber, total: created.total.toString() },
    });

    return created;
  }

  async update(id: string, dto: UpdateProformaDto, user: SafeUser) {
    const existing = await this.get(id, user.clientId);
    if (FROZEN_STATUSES.has(existing.status)) {
      throw new ConflictException({
        message: `Proforma cannot be edited in status ${existing.status}`,
        code: 'PROFORMA_FROZEN',
      });
    }
    if (dto.customerId !== undefined) await this.assertCustomer(user.clientId, dto.customerId);

    const totals = dto.items
      ? await this.computeTotals(user.clientId, dto.items, dto.customerId ?? existing.customerId)
      : null;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (totals) {
        await tx.proformaInvoiceItem.deleteMany({ where: { proformaInvoiceId: id } });
        await tx.proformaInvoiceItem.createMany({
          data: totals.items.map((i) => ({
            clientId: user.clientId,
            proformaInvoiceId: id,
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

      const data: Prisma.ProformaInvoiceUpdateInput = {
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

      return tx.proformaInvoice.update({
        where: { id },
        data,
        include: this.proformaInclude(),
      });
    });

    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'proforma.update',
      entity: 'ProformaInvoice',
      entityId: id,
      newValue: { total: updated.total.toString(), status: updated.status },
    });

    return updated;
  }

  async setStatus(id: string, status: ProformaInvoiceStatus, user: SafeUser) {
    const existing = await this.get(id, user.clientId);
    if (status === ProformaInvoiceStatus.CONVERTED_TO_INVOICE) {
      throw new BadRequestException({
        message: 'Use the conversion endpoint to convert this proforma',
        code: 'PROFORMA_USE_CONVERSION_ENDPOINT',
      });
    }
    if (FROZEN_STATUSES.has(existing.status) && existing.status !== status) {
      throw new ConflictException({
        message: `Proforma status cannot move out of ${existing.status}`,
        code: 'PROFORMA_FROZEN',
      });
    }
    const updated = await this.prisma.proformaInvoice.update({
      where: { id },
      data: { status },
      include: this.proformaInclude(),
    });
    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'proforma.status',
      entity: 'ProformaInvoice',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status },
    });
    return updated;
  }

  async approve(id: string, user: SafeUser) {
    return this.setStatus(id, ProformaInvoiceStatus.APPROVED, user);
  }

  async cancel(id: string, user: SafeUser) {
    const existing = await this.get(id, user.clientId);
    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelled = await tx.proformaInvoice.update({
        where: { id },
        data: { status: ProformaInvoiceStatus.CANCELLED },
        include: this.proformaInclude(),
      });
      // Release any active reservations tied to this proforma.
      await tx.stockReservation.updateMany({
        where: {
          clientId: user.clientId,
          sourceType: StockReservationSource.PROFORMA,
          sourceId: id,
          status: StockReservationStatus.ACTIVE,
        },
        data: { status: StockReservationStatus.RELEASED },
      });
      return cancelled;
    });

    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'proforma.cancel',
      entity: 'ProformaInvoice',
      entityId: id,
      oldValue: { status: existing.status },
      newValue: { status: ProformaInvoiceStatus.CANCELLED },
    });
    return updated;
  }

  // ---------- reservation ----------

  async reserveStock(id: string, user: SafeUser) {
    await this.assertReservationFeatureEnabled(user.clientId);
    const proforma = await this.get(id, user.clientId);
    if (FROZEN_STATUSES.has(proforma.status)) {
      throw new ConflictException({
        message: `Proforma cannot reserve stock in status ${proforma.status}`,
        code: 'PROFORMA_FROZEN',
      });
    }
    const existing = await this.prisma.stockReservation.findFirst({
      where: {
        clientId: user.clientId,
        sourceType: StockReservationSource.PROFORMA,
        sourceId: id,
        status: StockReservationStatus.ACTIVE,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Active reservation already exists for this proforma',
        code: 'RESERVATION_EXISTS',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const reservations = await Promise.all(
        proforma.items.map((it) =>
          tx.stockReservation.create({
            data: {
              clientId: user.clientId,
              branchId: proforma.branchId,
              productId: it.productId,
              customerId: proforma.customerId,
              sourceType: StockReservationSource.PROFORMA,
              sourceId: proforma.id,
              quantity: it.quantity,
              status: StockReservationStatus.ACTIVE,
              expiresAt: proforma.validUntil,
              createdById: user.id,
            },
          }),
        ),
      );
      await tx.proformaInvoice.update({
        where: { id: proforma.id },
        data: { reserveStock: true },
      });
      return reservations;
    });

    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'proforma.reserve_stock',
      entity: 'ProformaInvoice',
      entityId: proforma.id,
      newValue: { reservations: result.length },
    });

    return { reservations: result };
  }

  async releaseReservation(id: string, user: SafeUser) {
    const proforma = await this.get(id, user.clientId);
    const updated = await this.prisma.stockReservation.updateMany({
      where: {
        clientId: user.clientId,
        sourceType: StockReservationSource.PROFORMA,
        sourceId: proforma.id,
        status: StockReservationStatus.ACTIVE,
      },
      data: { status: StockReservationStatus.RELEASED },
    });
    await this.prisma.proformaInvoice.update({
      where: { id: proforma.id },
      data: { reserveStock: false },
    });
    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'proforma.release_reservation',
      entity: 'ProformaInvoice',
      entityId: proforma.id,
      newValue: { released: updated.count },
    });
    return { released: updated.count };
  }

  // ---------- conversion ----------

  async convertToInvoice(
    id: string,
    dto: ConvertProformaToInvoiceDto,
    user: SafeUser,
    branchId?: string,
  ) {
    const bid = await this.assertBranch(user.clientId, branchId);
    const existing = await this.get(id, user.clientId);
    if (FROZEN_STATUSES.has(existing.status)) {
      throw new ConflictException({
        message: `Proforma cannot be converted in status ${existing.status}`,
        code: 'PROFORMA_FROZEN',
      });
    }
    if (existing.branchId !== bid) {
      throw new ForbiddenException({
        message: 'You must convert this proforma from the branch that owns it',
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

    await this.prisma.$transaction(async (tx) => {
      await tx.sale.update({
        where: { id: sale.id },
        data: { sourceProformaId: existing.id },
      });
      await tx.proformaInvoice.update({
        where: { id: existing.id },
        data: {
          status: ProformaInvoiceStatus.CONVERTED_TO_INVOICE,
          convertedToInvoiceId: sale.id,
        },
      });
      // Mark active reservations as converted.
      await tx.stockReservation.updateMany({
        where: {
          clientId: user.clientId,
          sourceType: StockReservationSource.PROFORMA,
          sourceId: existing.id,
          status: StockReservationStatus.ACTIVE,
        },
        data: { status: StockReservationStatus.CONVERTED },
      });
      // Cascade source quotation status if this proforma was sourced from one.
      if (existing.quotationId) {
        await tx.quotation.updateMany({
          where: {
            id: existing.quotationId,
            clientId: user.clientId,
            status: { notIn: [QuotationStatus.CONVERTED_TO_INVOICE] },
          },
          data: { status: QuotationStatus.CONVERTED_TO_INVOICE, convertedToInvoiceId: sale.id },
        });
      }
    });

    if (sale.paymentStatus === PaymentStatus.PAID) {
      await this.commissions.calculateCommissionForSale(sale.id, user.clientId);
    }

    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'proforma.convert_to_invoice',
      entity: 'ProformaInvoice',
      entityId: existing.id,
      newValue: { saleId: sale.id, invoiceNumber: sale.invoiceNumber },
    });

    // PURCHASE_COMPLETED already fires from SalesService.create for the new invoice.
    return { proformaId: existing.id, sale };
  }
}
