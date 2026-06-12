import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SafeUser } from '../../auth/types/safe-user.type';
import { WholesaleScopeService } from '../wholesale-scope.service';
import { WholesalePricingService, type TierInput } from './wholesale-pricing.service';
import {
  AddProductToPriceListDto,
  AssignCustomerDto,
  CreatePriceListDto,
  ListPriceListsQueryDto,
  PreviewPriceDto,
  UpdatePriceListDto,
  UpdateTierDto,
  UpsertProductTiersDto,
} from './dto/bulk-pricing.dto';

@Injectable()
export class BulkPricingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: WholesaleScopeService,
    private readonly pricing: WholesalePricingService,
  ) {}

  async dashboard(clientId: string) {
    await this.scope.assertWholesaleBusiness(clientId);
    const [lists, productGroups, assignments, tiers] = await Promise.all([
      this.prisma.priceList.findMany({ where: { clientId }, select: { id: true, isActive: true } }),
      this.prisma.priceListItem.groupBy({
        by: ['productId'],
        where: { clientId },
      }),
      this.prisma.customerPriceList.count({ where: { clientId } }),
      this.prisma.priceListItem.findMany({
        where: { clientId },
        select: { unitPrice: true, productId: true, priceListId: true },
      }),
    ]);

    const productIds = new Set(productGroups.map((g) => g.productId));
    const activeLists = lists.filter((l) => l.isActive).length;

    let avgDiscountPct = 0;
    if (tiers.length) {
      const productPrices = await this.prisma.product.findMany({
        where: { id: { in: [...productIds] }, clientId },
        select: { id: true, sellingPrice: true },
      });
      const priceMap = new Map(productPrices.map((p) => [p.id, Number(p.sellingPrice)]));
      let sum = 0;
      let count = 0;
      for (const t of tiers) {
        const normal = priceMap.get(t.productId);
        if (!normal || normal <= 0) continue;
        const wholesale = Number(t.unitPrice);
        if (wholesale < normal) {
          sum += ((normal - wholesale) / normal) * 100;
          count++;
        }
      }
      avgDiscountPct = count ? sum / count : 0;
    }

    return {
      totalPriceLists: lists.length,
      activePriceLists: activeLists,
      productsWithBulkPricing: productIds.size,
      customersAssigned: assignments,
      averageDiscountPercent: Number(avgDiscountPct.toFixed(1)),
    };
  }

  async list(clientId: string, query: ListPriceListsQueryDto) {
    await this.scope.assertWholesaleBusiness(clientId);
    const where: Prisma.PriceListWhereInput = {
      clientId,
      ...(query.q ? { name: { contains: query.q, mode: 'insensitive' } } : {}),
      ...(query.status === 'active' ? { isActive: true } : {}),
      ...(query.status === 'inactive' ? { isActive: false } : {}),
      ...(query.hasCustomers ? { customers: { some: {} } } : {}),
      ...(query.hasProducts ? { items: { some: {} } } : {}),
    };
    const rows = await this.prisma.priceList.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { items: true, customers: true } },
      },
    });
    const listIds = rows.map((r) => r.id);
    const productCounts =
      listIds.length > 0
        ? await this.prisma.priceListItem.groupBy({
            by: ['priceListId', 'productId'],
            where: { clientId, priceListId: { in: listIds } },
          })
        : [];
    const productsByList = new Map<string, number>();
    for (const g of productCounts) {
      productsByList.set(g.priceListId, (productsByList.get(g.priceListId) ?? 0) + 1);
    }
    return rows.map((r) => ({
      ...r,
      productCount: productsByList.get(r.id) ?? 0,
    }));
  }

  async get(id: string, clientId: string) {
    await this.scope.assertWholesaleBusiness(clientId);
    const row = await this.prisma.priceList.findFirst({
      where: { id, clientId },
      include: {
        items: { orderBy: [{ productId: 'asc' }, { minQuantity: 'asc' }] },
        customers: {
          include: {
            customer: { select: { id: true, name: true, phone: true, balance: true } },
          },
        },
      },
    });
    if (!row) throw new NotFoundException('Price list not found');
    return row;
  }

  async create(dto: CreatePriceListDto, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    try {
      return await this.prisma.priceList.create({
        data: {
          clientId: user.clientId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          isActive: dto.isActive ?? true,
        },
        include: { _count: { select: { items: true, customers: true } } },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ message: 'A price list with this name already exists', code: 'NAME_EXISTS' });
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdatePriceListDto, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    await this.assertList(id, user.clientId);
    try {
      await this.prisma.priceList.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ message: 'A price list with this name already exists', code: 'NAME_EXISTS' });
      }
      throw e;
    }
    return this.get(id, user.clientId);
  }

  async setStatus(id: string, isActive: boolean, user: SafeUser) {
    return this.update(id, { isActive }, user);
  }

  async remove(id: string, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    await this.assertList(id, user.clientId);
    await this.prisma.priceList.delete({ where: { id } });
    return { ok: true };
  }

  async duplicate(id: string, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    const source = await this.get(id, user.clientId);
    const baseName = `${source.name} (copy)`;
    let name = baseName;
    let n = 2;
    while (
      await this.prisma.priceList.findFirst({ where: { clientId: user.clientId, name } })
    ) {
      name = `${baseName} ${n++}`;
    }
    return this.prisma.$transaction(async (tx) => {
      const copy = await tx.priceList.create({
        data: {
          clientId: user.clientId,
          name,
          description: source.description,
          isActive: false,
        },
      });
      if (source.items.length) {
        await tx.priceListItem.createMany({
          data: source.items.map((i) => ({
            clientId: user.clientId,
            priceListId: copy.id,
            productId: i.productId,
            minQuantity: i.minQuantity,
            maxQuantity: i.maxQuantity,
            unitPrice: i.unitPrice,
            notes: i.notes,
          })),
        });
      }
      return tx.priceList.findFirst({
        where: { id: copy.id },
        include: { _count: { select: { items: true, customers: true } } },
      });
    });
  }

  async listProducts(id: string, clientId: string) {
    const list = await this.get(id, clientId);
    const productIds = [...new Set(list.items.map((i) => i.productId))];
    const products = productIds.length
      ? await this.prisma.product.findMany({
          where: { clientId, id: { in: productIds } },
          select: { id: true, name: true, sku: true, barcode: true, sellingPrice: true },
        })
      : [];
    const pmap = new Map(products.map((p) => [p.id, p]));

    const grouped = new Map<string, typeof list.items>();
    for (const item of list.items) {
      const arr = grouped.get(item.productId) ?? [];
      arr.push(item);
      grouped.set(item.productId, arr);
    }

    return [...grouped.entries()].map(([productId, tiers]) => {
      const p = pmap.get(productId);
      const prices = tiers.map((t) => Number(t.unitPrice));
      const lowest = prices.length ? Math.min(...prices) : null;
      return {
        productId,
        product: p ?? null,
        tiers,
        tierCount: tiers.length,
        lowestWholesalePrice: lowest != null ? lowest.toString() : null,
        normalSellingPrice: p?.sellingPrice.toString() ?? null,
      };
    });
  }

  async addProduct(id: string, dto: AddProductToPriceListDto, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    await this.assertList(id, user.clientId);
    await this.scope.assertProduct(user.clientId, dto.productId);

    const existing = await this.prisma.priceListItem.findFirst({
      where: { clientId: user.clientId, priceListId: id, productId: dto.productId },
    });
    if (existing) {
      throw new ConflictException({
        message: 'Product already exists in this price list',
        code: 'PRODUCT_EXISTS',
      });
    }

    this.pricing.validateTiers(dto.tiers);

    await this.prisma.priceListItem.createMany({
      data: dto.tiers.map((t) => ({
        clientId: user.clientId,
        priceListId: id,
        productId: dto.productId,
        minQuantity: t.minQuantity,
        maxQuantity: t.maxQuantity ?? null,
        unitPrice: new Prisma.Decimal(t.unitPrice),
        notes: t.notes?.trim() || null,
      })),
    });
    return this.listProducts(id, user.clientId);
  }

  async upsertProductTiers(
    id: string,
    productId: string,
    dto: UpsertProductTiersDto,
    user: SafeUser,
  ) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    await this.assertList(id, user.clientId);
    await this.scope.assertProduct(user.clientId, productId);
    this.pricing.validateTiers(dto.tiers);

    await this.prisma.$transaction(async (tx) => {
      await tx.priceListItem.deleteMany({
        where: { clientId: user.clientId, priceListId: id, productId },
      });
      await tx.priceListItem.createMany({
        data: dto.tiers.map((t) => ({
          clientId: user.clientId,
          priceListId: id,
          productId,
          minQuantity: t.minQuantity,
          maxQuantity: t.maxQuantity ?? null,
          unitPrice: new Prisma.Decimal(t.unitPrice),
          notes: t.notes?.trim() || null,
        })),
      });
    });
    return this.listProducts(id, user.clientId);
  }

  async removeProduct(id: string, productId: string, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    await this.assertList(id, user.clientId);
    await this.prisma.priceListItem.deleteMany({
      where: { clientId: user.clientId, priceListId: id, productId },
    });
    return { ok: true };
  }

  async updateTier(tierId: string, dto: UpdateTierDto, user: SafeUser) {
    const tier = await this.prisma.priceListItem.findFirst({
      where: { id: tierId, clientId: user.clientId },
    });
    if (!tier) throw new NotFoundException('Tier not found');

    const siblings = await this.prisma.priceListItem.findMany({
      where: {
        clientId: user.clientId,
        priceListId: tier.priceListId,
        productId: tier.productId,
        id: { not: tierId },
      },
    });

    const merged: TierInput = {
      minQuantity: dto.minQuantity ?? tier.minQuantity,
      maxQuantity: dto.maxQuantity !== undefined ? dto.maxQuantity : tier.maxQuantity,
      unitPrice: dto.unitPrice ?? Number(tier.unitPrice),
      notes: dto.notes !== undefined ? dto.notes : tier.notes,
    };
    this.pricing.validateTiers([
      ...siblings.map((s) => ({
        minQuantity: s.minQuantity,
        maxQuantity: s.maxQuantity,
        unitPrice: Number(s.unitPrice),
        notes: s.notes,
      })),
      merged,
    ]);

    return this.prisma.priceListItem.update({
      where: { id: tierId },
      data: {
        ...(dto.minQuantity !== undefined ? { minQuantity: dto.minQuantity } : {}),
        ...(dto.maxQuantity !== undefined ? { maxQuantity: dto.maxQuantity } : {}),
        ...(dto.unitPrice !== undefined ? { unitPrice: new Prisma.Decimal(dto.unitPrice) } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      },
    });
  }

  async deleteTier(tierId: string, user: SafeUser) {
    const tier = await this.prisma.priceListItem.findFirst({
      where: { id: tierId, clientId: user.clientId },
    });
    if (!tier) throw new NotFoundException('Tier not found');
    await this.prisma.priceListItem.delete({ where: { id: tierId } });
    return { ok: true };
  }

  async listCustomers(id: string, clientId: string) {
    const list = await this.get(id, clientId);
    return list.customers.map((c) => ({
      id: c.id,
      customerId: c.customerId,
      priceListId: c.priceListId,
      assignedAt: c.createdAt,
      customer: c.customer,
    }));
  }

  async assignCustomer(id: string, dto: AssignCustomerDto, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    await this.assertList(id, user.clientId);
    await this.scope.assertCustomer(user.clientId, dto.customerId);

    const existing = await this.prisma.customerPriceList.findFirst({
      where: { clientId: user.clientId, customerId: dto.customerId },
      include: { priceList: { select: { name: true } } },
    });

    if (existing && existing.priceListId !== id && !dto.replaceExisting) {
      throw new ConflictException({
        message: `Customer already assigned to "${existing.priceList.name}". Send replaceExisting=true to replace.`,
        code: 'CUSTOMER_ALREADY_ASSIGNED',
        existingPriceListId: existing.priceListId,
        existingPriceListName: existing.priceList.name,
      });
    }

    return this.prisma.customerPriceList.upsert({
      where: { clientId_customerId: { clientId: user.clientId, customerId: dto.customerId } },
      create: { clientId: user.clientId, customerId: dto.customerId, priceListId: id },
      update: { priceListId: id },
      include: { customer: { select: { id: true, name: true, phone: true, balance: true } } },
    });
  }

  async unassignCustomer(id: string, customerId: string, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    await this.assertList(id, user.clientId);
    const row = await this.prisma.customerPriceList.findFirst({
      where: { clientId: user.clientId, customerId, priceListId: id },
    });
    if (!row) throw new NotFoundException('Customer assignment not found');
    await this.prisma.customerPriceList.delete({ where: { id: row.id } });
    return { ok: true };
  }

  async preview(clientId: string, dto: PreviewPriceDto) {
    await this.scope.assertWholesaleBusiness(clientId);
    return this.pricing.resolveWholesalePrice({
      clientId,
      customerId: dto.customerId,
      productId: dto.productId,
      quantity: dto.quantity,
    });
  }

  private async assertList(id: string, clientId: string) {
    const row = await this.prisma.priceList.findFirst({ where: { id, clientId } });
    if (!row) throw new NotFoundException('Price list not found');
    return row;
  }
}
