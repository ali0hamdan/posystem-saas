import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SafeUser } from '../../auth/types/safe-user.type';
import { WholesaleScopeService } from '../wholesale-scope.service';
import { WholesalePricingService } from '../bulk-pricing/wholesale-pricing.service';
import {
  AssignCustomerPriceListDto,
  CreatePriceListDto,
  ResolvePriceQueryDto,
  UpdatePriceListDto,
  UpsertPriceListItemsDto,
} from './dto/price-list.dto';

@Injectable()
export class PriceListsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: WholesaleScopeService,
    private readonly pricing: WholesalePricingService,
  ) {}

  async list(clientId: string) {
    await this.scope.assertWholesaleBusiness(clientId);
    return this.prisma.priceList.findMany({
      where: { clientId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { items: true, customers: true } } },
    });
  }

  async get(id: string, clientId: string) {
    await this.scope.assertWholesaleBusiness(clientId);
    const row = await this.prisma.priceList.findFirst({
      where: { id, clientId },
      include: { items: { orderBy: [{ productId: 'asc' }, { minQuantity: 'asc' }] }, customers: true },
    });
    if (!row) throw new NotFoundException('Price list not found');
    return row;
  }

  async create(dto: CreatePriceListDto, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    return this.prisma.$transaction(async (tx) => {
      const list = await tx.priceList.create({
        data: {
          clientId: user.clientId,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          isActive: dto.isActive ?? true,
        },
      });
      if (dto.items?.length) {
        for (const item of dto.items) {
          await this.scope.assertProduct(user.clientId, item.productId);
        }
        await tx.priceListItem.createMany({
          data: dto.items.map((i) => ({
            clientId: user.clientId,
            priceListId: list.id,
            productId: i.productId,
            minQuantity: i.minQuantity,
            unitPrice: new Prisma.Decimal(i.unitPrice),
          })),
        });
      }
      return this.get(list.id, user.clientId);
    });
  }

  async update(id: string, dto: UpdatePriceListDto, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    const exists = await this.prisma.priceList.findFirst({ where: { id, clientId: user.clientId } });
    if (!exists) throw new NotFoundException('Price list not found');
    await this.prisma.priceList.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    return this.get(id, user.clientId);
  }

  async upsertItems(id: string, dto: UpsertPriceListItemsDto, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    const exists = await this.prisma.priceList.findFirst({ where: { id, clientId: user.clientId } });
    if (!exists) throw new NotFoundException('Price list not found');
    for (const item of dto.items) await this.scope.assertProduct(user.clientId, item.productId);
    await this.prisma.$transaction(async (tx) => {
      await tx.priceListItem.deleteMany({ where: { priceListId: id, clientId: user.clientId } });
      await tx.priceListItem.createMany({
        data: dto.items.map((i) => ({
          clientId: user.clientId,
          priceListId: id,
          productId: i.productId,
          minQuantity: i.minQuantity,
          unitPrice: new Prisma.Decimal(i.unitPrice),
        })),
      });
    });
    return this.get(id, user.clientId);
  }

  async assignCustomer(dto: AssignCustomerPriceListDto, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    await this.scope.assertCustomer(user.clientId, dto.customerId);
    const list = await this.prisma.priceList.findFirst({
      where: { id: dto.priceListId, clientId: user.clientId, isActive: true },
    });
    if (!list) throw new NotFoundException('Price list not found');
    return this.prisma.customerPriceList.upsert({
      where: { clientId_customerId: { clientId: user.clientId, customerId: dto.customerId } },
      create: { clientId: user.clientId, customerId: dto.customerId, priceListId: dto.priceListId },
      update: { priceListId: dto.priceListId },
    });
  }

  async resolvePrice(clientId: string, query: ResolvePriceQueryDto) {
    await this.scope.assertWholesaleBusiness(clientId);
    const result = await this.pricing.resolveWholesalePrice({
      clientId,
      customerId: query.customerId,
      productId: query.productId,
      quantity: query.quantity,
    });
    return {
      productId: result.productId,
      quantity: result.quantity,
      unitPrice: result.finalUnitPrice,
      priceListId: result.appliedPriceListId,
      applied: result.applied,
      appliedPriceListName: result.appliedPriceListName,
      normalUnitPrice: result.normalUnitPrice,
      savings: result.savings,
    };
  }
}
