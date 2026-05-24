import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { CouponType, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SafeUser } from '../auth/types/safe-user.type';
import { CreateCouponDto, UpdateCouponDto, ValidateCouponDto } from './dto/coupon.dto';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  private requireAdminOrOwner(user: SafeUser) {
    if (user.role === UserRole.CASHIER) {
      throw new ForbiddenException({ message: 'Cashiers cannot manage coupons', code: 'FORBIDDEN' });
    }
  }

  async create(user: SafeUser, dto: CreateCouponDto) {
    this.requireAdminOrOwner(user);
    const existing = await this.prisma.coupon.findUnique({
      where: { clientId_code: { clientId: user.clientId, code: dto.code } },
    });
    if (existing) {
      throw new BadRequestException({ message: 'Coupon code already exists', code: 'COUPON_CODE_EXISTS' });
    }
    return this.prisma.coupon.create({
      data: {
        clientId: user.clientId,
        code: dto.code,
        type: dto.type,
        value: new Prisma.Decimal(dto.value),
        minOrderAmount: dto.minOrderAmount != null ? new Prisma.Decimal(dto.minOrderAmount) : null,
        maxUses: dto.maxUses ?? null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async findAll(user: SafeUser, includeInactive = false) {
    this.requireAdminOrOwner(user);
    return this.prisma.coupon.findMany({
      where: {
        clientId: user.clientId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(user: SafeUser, id: string) {
    this.requireAdminOrOwner(user);
    const coupon = await this.prisma.coupon.findFirst({
      where: { id, clientId: user.clientId },
    });
    if (!coupon) throw new NotFoundException({ message: 'Coupon not found', code: 'NOT_FOUND' });
    return coupon;
  }

  async update(user: SafeUser, id: string, dto: UpdateCouponDto) {
    this.requireAdminOrOwner(user);
    const { count } = await this.prisma.coupon.updateMany({
      where: { id, clientId: user.clientId },
      data: {
        isActive: dto.isActive,
        minOrderAmount: dto.minOrderAmount != null ? new Prisma.Decimal(dto.minOrderAmount) : undefined,
        maxUses: dto.maxUses,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      },
    });
    if (count === 0) {
      throw new NotFoundException({ message: 'Coupon not found', code: 'NOT_FOUND' });
    }
    return this.findOne(user, id);
  }

  async remove(user: SafeUser, id: string) {
    this.requireAdminOrOwner(user);
    const { count } = await this.prisma.coupon.deleteMany({
      where: { id, clientId: user.clientId },
    });
    if (count === 0) {
      throw new NotFoundException({ message: 'Coupon not found', code: 'NOT_FOUND' });
    }
    return { ok: true };
  }

  /** Validate a coupon code for a given order amount. Returns computed discount. */
  async validate(user: SafeUser, dto: ValidateCouponDto) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { clientId_code: { clientId: user.clientId, code: dto.code } },
    });

    if (!coupon || !coupon.isActive) {
      throw new BadRequestException({ message: 'Invalid or inactive coupon', code: 'COUPON_INVALID' });
    }
    if (coupon.expiresAt && coupon.expiresAt < new Date()) {
      throw new BadRequestException({ message: 'Coupon has expired', code: 'COUPON_EXPIRED' });
    }
    if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses) {
      throw new BadRequestException({ message: 'Coupon usage limit reached', code: 'COUPON_EXHAUSTED' });
    }
    if (coupon.minOrderAmount && new Prisma.Decimal(dto.orderAmount).lt(coupon.minOrderAmount)) {
      throw new BadRequestException({
        message: `Minimum order amount for this coupon is ${coupon.minOrderAmount}`,
        code: 'COUPON_MIN_ORDER',
      });
    }

    const orderDec = new Prisma.Decimal(dto.orderAmount);
    let discount: Prisma.Decimal;
    if (coupon.type === CouponType.PERCENTAGE) {
      discount = orderDec.mul(coupon.value).div(100);
    } else {
      discount = coupon.value.lte(orderDec) ? coupon.value : orderDec;
    }

    return {
      couponId: coupon.id,
      code: coupon.code,
      type: coupon.type,
      value: coupon.value.toString(),
      discount: discount.toDecimalPlaces(2).toString(),
    };
  }
}
