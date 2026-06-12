import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

const ACTIVE = ['OPEN', 'SENT', 'READY', 'SERVED'];

@Injectable()
export class FnbReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertBranch(clientId: string, branchId?: string): Promise<string> {
    if (!branchId) throw new BadRequestException({ message: 'X-Branch-Id header is required', code: 'BRANCH_REQUIRED' });
    const b = await this.prisma.branch.findFirst({ where: { id: branchId, clientId, isActive: true }, select: { id: true } });
    if (!b) throw new BadRequestException({ message: 'Invalid branch', code: 'INVALID_BRANCH' });
    return branchId;
  }

  async dashboard(clientId: string, branchId?: string) {
    const bid = await this.assertBranch(clientId, branchId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [openOrders, today, tablesTotal, tablesOccupied, activeTickets] = await Promise.all([
      this.prisma.fnbOrder.count({ where: { clientId, branchId: bid, status: { in: ACTIVE as never[] } } }),
      this.prisma.fnbOrder.aggregate({ where: { clientId, branchId: bid, status: 'COMPLETED' as never, closedAt: { gte: startOfDay } }, _count: { _all: true }, _sum: { total: true } }),
      this.prisma.restaurantTable.count({ where: { clientId, branchId: bid, isActive: true } }),
      this.prisma.restaurantTable.count({ where: { clientId, branchId: bid, isActive: true, status: 'OCCUPIED' as never } }),
      this.prisma.kitchenTicket.count({ where: { clientId, branchId: bid, status: { in: ['QUEUED', 'PREPARING', 'READY'] as never[] } } }),
    ]);

    return {
      openOrders,
      todayOrders: today._count._all,
      todayRevenue: today._sum.total ?? 0,
      tablesTotal,
      tablesOccupied,
      activeTickets,
    };
  }

  async report(clientId: string, branchId: string | undefined, from?: string, to?: string) {
    const bid = await this.assertBranch(clientId, branchId);
    const now = new Date();
    const start = from ? new Date(`${from}T00:00:00.000Z`) : new Date(now.getTime() - 6 * 24 * 3600 * 1000);
    const end = to ? new Date(`${to}T23:59:59.999Z`) : now;
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      throw new BadRequestException({ message: 'Invalid date range', code: 'INVALID_DATE_RANGE' });
    }

    const where = { clientId, branchId: bid, status: 'COMPLETED' as never, closedAt: { gte: start, lte: end } };
    const [agg, byType, topItems] = await Promise.all([
      this.prisma.fnbOrder.aggregate({ where, _count: { _all: true }, _sum: { total: true, subtotal: true, taxTotal: true } }),
      this.prisma.fnbOrder.groupBy({ by: ['type'], where, _count: { _all: true }, _sum: { total: true } }),
      this.prisma.fnbOrderItem.groupBy({
        by: ['name'],
        where: { order: { is: where } },
        _sum: { quantity: true, lineTotal: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 10,
      }),
    ]);

    const orders = agg._count._all;
    const revenue = Number(agg._sum.total ?? 0);
    return {
      range: { from: start.toISOString(), to: end.toISOString() },
      totals: {
        orders,
        revenue,
        tax: Number(agg._sum.taxTotal ?? 0),
        avgOrder: orders > 0 ? Number((revenue / orders).toFixed(2)) : 0,
      },
      byType: byType.map((t) => ({ type: t.type, orders: t._count._all, revenue: Number(t._sum.total ?? 0) })),
      topItems: topItems.map((i) => ({ name: i.name, quantity: i._sum.quantity ?? 0, revenue: Number(i._sum.lineTotal ?? 0) })),
    };
  }
}
