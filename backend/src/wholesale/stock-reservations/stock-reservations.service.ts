import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { StockReservationStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SafeUser } from '../../auth/types/safe-user.type';
import { WholesaleScopeService } from '../wholesale-scope.service';
import { ListStockReservationsQueryDto } from './dto/stock-reservation.dto';

@Injectable()
export class StockReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: WholesaleScopeService,
  ) {}

  async list(clientId: string, branchId: string | undefined, query: ListStockReservationsQueryDto) {
    await this.scope.assertWholesaleBusiness(clientId);
    const where = {
      clientId,
      ...(branchId ? { branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.productId ? { productId: query.productId } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
    };
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const [data, total] = await Promise.all([
      this.prisma.stockReservation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockReservation.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async release(id: string, user: SafeUser) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    const row = await this.prisma.stockReservation.findFirst({
      where: { id, clientId: user.clientId },
    });
    if (!row) throw new NotFoundException('Reservation not found');
    if (row.status !== StockReservationStatus.ACTIVE) {
      throw new BadRequestException({ message: 'Only active reservations can be released', code: 'INVALID_STATUS' });
    }
    return this.prisma.stockReservation.update({
      where: { id },
      data: { status: StockReservationStatus.RELEASED },
    });
  }
}
