import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma, StockMovementType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import { StockService } from '../stock/stock.service';
import { SettingsService } from '../settings/settings.service';
import { CreateProductDto, ListProductsQueryDto, ProductSearchQueryDto } from './dto/product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

type ProductListRow = Prisma.ProductGetPayload<{
  include: { category: true; supplier: true; branchStocks: true };
}>;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly stockService: StockService,
    private readonly settingsService: SettingsService,
  ) {}

  private canSeeInactive(role: UserRole, includeInactive?: boolean): boolean {
    return (
      includeInactive === true &&
      (role === UserRole.OWNER || role === UserRole.ADMIN)
    );
  }

  /** API shape: legacy `quantity` / `minStock` for the request branch. */
  private mapProductForBranch(product: ProductListRow) {
    const bs = product.branchStocks[0];
    const { branchStocks, ...rest } = product;
    return {
      ...rest,
      quantity: bs?.quantity ?? 0,
      minStock: bs?.minStock ?? 0,
    };
  }

  private branchStockInclude(branchId: string) {
    return {
      where: { branchId },
      take: 1,
    } as const;
  }

  private productListWhere(
    clientId: string,
    query: ListProductsQueryDto | ProductSearchQueryDto,
    role: UserRole,
  ): Prisma.ProductWhereInput {
    const showInactive = this.canSeeInactive(role, query.includeInactive);
    const where: Prisma.ProductWhereInput = {
      clientId,
      ...(showInactive ? {} : { isActive: true }),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...('q' in query && query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { barcode: { contains: query.q, mode: 'insensitive' } },
              { sku: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    return where;
  }

  async findAll(query: ListProductsQueryDto, role: UserRole, branchId: string, clientId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.productListWhere(clientId, query, role);

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          category: true,
          supplier: true,
          branchStocks: this.branchStockInclude(branchId),
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: items.map((p) => this.mapProductForBranch(p as ProductListRow)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async search(query: ProductSearchQueryDto, role: UserRole, branchId: string, clientId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where = this.productListWhere(
      clientId,
      {
        ...query,
        q: query.q,
        includeInactive: query.includeInactive,
      },
      role,
    );

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
        include: {
          category: true,
          supplier: true,
          branchStocks: this.branchStockInclude(branchId),
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      data: items.map((p) => this.mapProductForBranch(p as ProductListRow)),
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findLowStock(query: ListProductsQueryDto, _role: UserRole, branchId: string, clientId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        barcode: string | null;
        sku: string | null;
        categoryId: string;
        supplierId: string | null;
        costPrice: Prisma.Decimal;
        sellingPrice: Prisma.Decimal;
        quantity: number;
        minStock: number;
        unitType: string;
        imageUrl: string | null;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      }>
    >(
      Prisma.sql`
        SELECT p."id", p."name", p."barcode", p."sku", p."categoryId", p."supplierId",
               p."costPrice", p."sellingPrice", p."unitType", p."imageUrl", p."isActive",
               p."createdAt", p."updatedAt",
               bs."quantity", bs."minStock"
        FROM "Product" p
        INNER JOIN "BranchStock" bs ON bs."productId" = p."id" AND bs."branchId" = ${branchId}
        WHERE p."clientId" = ${clientId}
          AND p."isActive" = true
          AND bs."quantity" <= bs."minStock"
        ORDER BY bs."quantity" ASC
        OFFSET ${skip}
        LIMIT ${limit}
      `,
    );

    const countRow = await this.prisma.$queryRaw<[{ c: bigint }]>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS c
        FROM "Product" p
        INNER JOIN "BranchStock" bs ON bs."productId" = p."id" AND bs."branchId" = ${branchId}
        WHERE p."clientId" = ${clientId}
          AND p."isActive" = true
          AND bs."quantity" <= bs."minStock"
      `,
    );

    const total = Number(countRow[0].c);

    return {
      data: rows,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findByBarcode(barcode: string, role: UserRole, branchId: string, clientId: string) {
    const decoded = decodeURIComponent(barcode).trim();
    const product = await this.prisma.product.findFirst({
      where: { clientId, barcode: decoded },
      include: {
        category: true,
        supplier: true,
        branchStocks: this.branchStockInclude(branchId),
      },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'Product not found for this barcode',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    if (!product.isActive && role === UserRole.CASHIER) {
      throw new NotFoundException({
        message: 'Product not found for this barcode',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    return this.mapProductForBranch(product as ProductListRow);
  }

  async findOne(id: string, role: UserRole, branchId: string, clientId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, clientId },
      include: {
        category: true,
        supplier: true,
        branchStocks: this.branchStockInclude(branchId),
      },
    });
    if (!product) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    if (!product.isActive && role === UserRole.CASHIER) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    return this.mapProductForBranch(product as ProductListRow);
  }

  async create(dto: CreateProductDto, userId: string, branchId: string, clientId: string) {
    await this.assertCategoryExists(dto.categoryId, clientId);
    if (dto.supplierId) {
      await this.assertSupplierExists(dto.supplierId, clientId);
    }

    // Auto-generate SKU from category + product name if not provided by frontend
    if (!this.emptyToNull(dto.sku)) {
      dto.sku = await this.generateSku(clientId, dto.categoryId, dto.name);
    }

    const initialQty = dto.quantity ?? 0;
    const store = await this.settingsService.get(clientId);

    try {
      const full = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            clientId,
            name: dto.name.trim(),
            barcode: this.emptyToNull(dto.barcode),
            sku: this.emptyToNull(dto.sku),
            categoryId: dto.categoryId,
            supplierId: dto.supplierId ?? null,
            costPrice: new Prisma.Decimal(dto.costPrice),
            sellingPrice: new Prisma.Decimal(dto.sellingPrice),
            unitType: dto.unitType?.trim() || 'PIECE',
            imageUrl: this.emptyToNull(dto.imageUrl),
            isActive: dto.isActive ?? true,
          },
        });

        const branches = await tx.branch.findMany({
          where: { isActive: true, clientId },
          select: { id: true },
        });
        const minDef = dto.minStock ?? store.lowStockDefault;
        for (const { id: bid } of branches) {
          await tx.branchStock.create({
            data: {
              branchId: bid,
              productId: created.id,
              quantity: 0,
              minStock: minDef,
            },
          });
        }

        if (initialQty > 0) {
          await this.stockService.adjustStock(
            {
              branchId,
              clientId,
              productId: created.id,
              quantityChange: initialQty,
              type: StockMovementType.ADJUSTMENT,
              reason: 'Initial stock on product creation',
              createdById: userId,
              referenceType: 'product',
              referenceId: created.id,
              allowNegativeStock: false,
            },
            tx,
          );
        }

        const withRelations = await tx.product.findUnique({
          where: { id: created.id },
          include: {
            category: true,
            supplier: true,
            branchStocks: this.branchStockInclude(branchId),
          },
        });
        if (!withRelations) {
          throw new InternalServerErrorException(
            'Product missing after create',
          );
        }
        return this.mapProductForBranch(withRelations as ProductListRow);
      });

      await this.audit.log({
        userId,
        clientId,
        action: 'product.create',
        entity: 'Product',
        entityId: full.id,
        newValue: full,
      });
      return full;
    } catch (err) {
      this.throwIfUniqueViolation(err);
      throw err;
    }
  }

  async update(id: string, dto: UpdateProductDto, userId: string, branchId: string, clientId: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, clientId } });
    if (!existing) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }

    if (dto.categoryId) {
      await this.assertCategoryExists(dto.categoryId, clientId);
    }
    if (dto.supplierId !== undefined) {
      await this.assertSupplierExists(dto.supplierId, clientId);
    }

    const data: Prisma.ProductUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.barcode !== undefined
        ? { barcode: this.emptyToNull(dto.barcode) }
        : {}),
      ...(dto.sku !== undefined ? { sku: this.emptyToNull(dto.sku) } : {}),
      ...(dto.categoryId !== undefined
        ? { category: { connect: { id: dto.categoryId } } }
        : {}),
      ...(dto.supplierId !== undefined
        ? { supplier: { connect: { id: dto.supplierId } } }
        : {}),
      ...(dto.costPrice !== undefined
        ? { costPrice: new Prisma.Decimal(dto.costPrice) }
        : {}),
      ...(dto.sellingPrice !== undefined
        ? { sellingPrice: new Prisma.Decimal(dto.sellingPrice) }
        : {}),
      ...(dto.unitType !== undefined
        ? { unitType: dto.unitType.trim() || 'PIECE' }
        : {}),
      ...(dto.imageUrl !== undefined
        ? { imageUrl: this.emptyToNull(dto.imageUrl) }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    const hasProductFields = Object.keys(data).length > 0;
    const hasMinStock = dto.minStock !== undefined;
    if (!hasProductFields && !hasMinStock) {
      throw new BadRequestException({
        message: 'No updatable fields provided',
        code: 'EMPTY_UPDATE',
      });
    }

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        if (hasProductFields) {
          await tx.product.update({
            where: { id },
            data,
          });
        }
        if (hasMinStock) {
          await tx.branchStock.updateMany({
            where: { productId: id, branchId },
            data: { minStock: dto.minStock },
          });
        }
        const refreshed = await tx.product.findUnique({
          where: { id },
          include: {
            category: true,
            supplier: true,
            branchStocks: this.branchStockInclude(branchId),
          },
        });
        if (!refreshed) {
          throw new NotFoundException({
            message: 'Product not found',
            code: 'PRODUCT_NOT_FOUND',
          });
        }
        return this.mapProductForBranch(refreshed as ProductListRow);
      });
      await this.audit.log({
        userId,
        clientId,
        action: 'product.update',
        entity: 'Product',
        entityId: id,
        oldValue: existing,
        newValue: updated,
      });
      return updated;
    } catch (err) {
      this.throwIfUniqueViolation(err);
      throw err;
    }
  }

  async softDelete(id: string, userId: string, branchId: string, clientId: string) {
    const existing = await this.prisma.product.findFirst({ where: { id, clientId } });
    if (!existing) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    const updated = await this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
        branchStocks: this.branchStockInclude(branchId),
      },
    });
    if (!updated) {
      throw new NotFoundException({
        message: 'Product not found',
        code: 'PRODUCT_NOT_FOUND',
      });
    }
    const mapped = this.mapProductForBranch(updated as ProductListRow);
    await this.audit.log({
      userId,
      clientId,
      action: 'product.soft_delete',
      entity: 'Product',
      entityId: id,
      oldValue: existing,
      newValue: mapped,
    });
    return mapped;
  }

  async generateSku(
    clientId: string,
    categoryId: string,
    productName: string,
    excludeId?: string,
  ): Promise<string> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, clientId },
      select: { name: true },
    });
    if (!category) {
      throw new NotFoundException({ message: 'Category not found', code: 'CATEGORY_NOT_FOUND' });
    }

    const catAlpha = category.name.toUpperCase().replace(/[^A-Z]/g, '');
    const catPrefix = catAlpha.slice(0, 3).padEnd(3, 'X');

    const slug =
      productName
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 15) || 'PRODUCT';

    const prefix = `${catPrefix}-${slug}-`;

    const existing = await this.prisma.product.findMany({
      where: {
        clientId,
        sku: { startsWith: prefix },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { sku: true },
    });

    const nums = existing
      .map((p) => parseInt((p.sku ?? '').slice(prefix.length), 10))
      .filter((n) => Number.isFinite(n) && n > 0);

    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return `${catPrefix}-${slug}-${String(next).padStart(4, '0')}`;
  }

  async generateInternalBarcode(clientId: string): Promise<string> {
    const existing = await this.prisma.product.findMany({
      where: { clientId, barcode: { startsWith: '2' } },
      select: { barcode: true },
    });

    const nums = existing
      .map((p) => p.barcode ?? '')
      .filter((b) => /^2\d{11}$/.test(b))
      .map((b) => parseInt(b, 10));

    const base = 200000000000;
    const next = nums.length > 0 ? Math.max(...nums) + 1 : base + 1;
    return String(next);
  }

  async checkBarcodeUnique(
    clientId: string,
    barcode: string,
    excludeId?: string,
  ): Promise<{ available: boolean; conflictProductName?: string }> {
    const existing = await this.prisma.product.findFirst({
      where: {
        clientId,
        barcode: barcode.trim(),
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true, name: true },
    });
    if (!existing) return { available: true };
    return { available: false, conflictProductName: existing.name };
  }

  private emptyToNull(v?: string | null): string | null {
    if (v === undefined || v === null) return null;
    const t = v.trim();
    return t.length === 0 ? null : t;
  }

  private async assertCategoryExists(id: string, clientId: string): Promise<void> {
    const c = await this.prisma.category.findFirst({ where: { id, clientId } });
    if (!c || !c.isActive) {
      throw new NotFoundException({
        message: 'Category not found or inactive',
        code: 'CATEGORY_NOT_FOUND',
      });
    }
  }

  private async assertSupplierExists(id: string, clientId: string): Promise<void> {
    const s = await this.prisma.supplier.findFirst({ where: { id, clientId } });
    if (!s || !s.isActive) {
      throw new NotFoundException({
        message: 'Supplier not found or inactive',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
  }

  private throwIfUniqueViolation(err: unknown): void {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw new ConflictException({
        message: 'Barcode or SKU must be unique',
        code: 'UNIQUE_VIOLATION',
      });
    }
  }
}
