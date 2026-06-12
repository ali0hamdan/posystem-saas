import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type TierInput = {
  minQuantity: number;
  maxQuantity?: number | null;
  unitPrice: number;
  notes?: string | null;
};

export type ResolveWholesalePriceInput = {
  clientId: string;
  customerId?: string | null;
  productId: string;
  quantity: number;
};

export type ResolveWholesalePriceResult = {
  applied: boolean;
  productId: string;
  quantity: number;
  normalUnitPrice: string;
  finalUnitPrice: string;
  appliedPriceListId: string | null;
  appliedPriceListName: string | null;
  appliedTier: {
    id: string;
    minQuantity: number;
    maxQuantity: number | null;
    unitPrice: string;
  } | null;
  normalTotal: string;
  finalTotal: string;
  savings: string;
  discountPerUnit: string;
};

@Injectable()
export class WholesalePricingService {
  constructor(private readonly prisma: PrismaService) {}

  validateTiers(tiers: TierInput[]): void {
    if (!tiers.length) {
      throw new BadRequestException({ message: 'At least one tier is required', code: 'TIERS_REQUIRED' });
    }
    const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
    const minQtySet = new Set<number>();
    let openEnded = 0;

    for (let i = 0; i < sorted.length; i++) {
      const t = sorted[i]!;
      if (t.minQuantity < 1) {
        throw new BadRequestException({ message: 'minQuantity must be at least 1', code: 'INVALID_TIER' });
      }
      if (minQtySet.has(t.minQuantity)) {
        throw new BadRequestException({
          message: 'Duplicate minQuantity not allowed for the same product',
          code: 'DUPLICATE_MIN_QTY',
        });
      }
      minQtySet.add(t.minQuantity);

      if (t.maxQuantity != null) {
        if (t.maxQuantity < t.minQuantity) {
          throw new BadRequestException({
            message: 'maxQuantity must be greater than minQuantity',
            code: 'INVALID_TIER',
          });
        }
      } else {
        openEnded++;
        if (openEnded > 1) {
          throw new BadRequestException({
            message: 'Only one open-ended tier is allowed',
            code: 'INVALID_TIER',
          });
        }
        if (i < sorted.length - 1) {
          throw new BadRequestException({
            message: 'Open-ended tier must be the last tier',
            code: 'INVALID_TIER',
          });
        }
      }

      if (i > 0) {
        const prev = sorted[i - 1]!;
        const prevEnd = prev.maxQuantity ?? Number.POSITIVE_INFINITY;
        if (t.minQuantity <= prevEnd) {
          throw new BadRequestException({
            message: 'Quantity tiers cannot overlap.',
            code: 'TIERS_OVERLAP',
          });
        }
      }
    }
  }

  findMatchingTier(
    tiers: { id: string; minQuantity: number; maxQuantity: number | null; unitPrice: Prisma.Decimal }[],
    quantity: number,
  ) {
    const sorted = [...tiers].sort((a, b) => b.minQuantity - a.minQuantity);
    for (const tier of sorted) {
      if (quantity < tier.minQuantity) continue;
      if (tier.maxQuantity != null && quantity > tier.maxQuantity) continue;
      return tier;
    }
    return null;
  }

  async resolveWholesalePrice(input: ResolveWholesalePriceInput): Promise<ResolveWholesalePriceResult> {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, clientId: input.clientId },
      select: { sellingPrice: true },
    });
    if (!product) {
      throw new BadRequestException({ message: 'Product not found', code: 'PRODUCT_NOT_FOUND' });
    }

    const normal = new Prisma.Decimal(product.sellingPrice.toString());
    const qty = input.quantity;
    const normalTotal = normal.mul(qty);

    let priceListId: string | null = null;
    let priceListName: string | null = null;

    if (input.customerId) {
      const assign = await this.prisma.customerPriceList.findFirst({
        where: { clientId: input.clientId, customerId: input.customerId },
        include: { priceList: { select: { id: true, name: true, isActive: true } } },
      });
      if (assign?.priceList?.isActive) {
        priceListId = assign.priceList.id;
        priceListName = assign.priceList.name;
      }
    }

    if (!priceListId) {
      const finalUnitPrice = normal;
      return {
        applied: false,
        productId: input.productId,
        quantity: qty,
        normalUnitPrice: normal.toString(),
        finalUnitPrice: finalUnitPrice.toString(),
        appliedPriceListId: null,
        appliedPriceListName: null,
        appliedTier: null,
        normalTotal: normalTotal.toString(),
        finalTotal: normalTotal.toString(),
        savings: '0',
        discountPerUnit: '0',
      };
    }

    const tiers = await this.prisma.priceListItem.findMany({
      where: { clientId: input.clientId, priceListId, productId: input.productId },
      orderBy: { minQuantity: 'asc' },
    });

    const match = this.findMatchingTier(tiers, qty);
    const finalUnit = match ? match.unitPrice : normal;
    const finalTotal = finalUnit.mul(qty);
    const savings = normalTotal.sub(finalTotal);
    const discountPerUnit = normal.sub(finalUnit);

    return {
      applied: Boolean(match),
      productId: input.productId,
      quantity: qty,
      normalUnitPrice: normal.toString(),
      finalUnitPrice: finalUnit.toString(),
      appliedPriceListId: priceListId,
      appliedPriceListName: priceListName,
      appliedTier: match
        ? {
            id: match.id,
            minQuantity: match.minQuantity,
            maxQuantity: match.maxQuantity,
            unitPrice: match.unitPrice.toString(),
          }
        : null,
      normalTotal: normalTotal.toString(),
      finalTotal: finalTotal.toString(),
      savings: savings.gt(0) ? savings.toString() : '0',
      discountPerUnit: discountPerUnit.gt(0) ? discountPerUnit.toString() : '0',
    };
  }
}
