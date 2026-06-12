import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { KitchenStatusValue, ListKitchenQueryDto } from './dto/kitchen.dto';

const ACTIVE = ['QUEUED', 'PREPARING', 'READY'];

@Injectable()
export class FnbKitchenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private async assertBranch(clientId: string, branchId?: string): Promise<string> {
    if (!branchId) throw new BadRequestException({ message: 'X-Branch-Id header is required', code: 'BRANCH_REQUIRED' });
    const b = await this.prisma.branch.findFirst({ where: { id: branchId, clientId, isActive: true }, select: { id: true } });
    if (!b) throw new BadRequestException({ message: 'Invalid branch', code: 'INVALID_BRANCH' });
    return branchId;
  }

  async list(clientId: string, branchId: string | undefined, query: ListKitchenQueryDto) {
    const bid = await this.assertBranch(clientId, branchId);
    const statusFilter =
      !query.status || query.status === 'ACTIVE'
        ? { status: { in: ACTIVE as never[] } }
        : { status: query.status as never };
    return this.prisma.kitchenTicket.findMany({
      where: { clientId, branchId: bid, ...statusFilter, ...(query.station ? { station: query.station } : {}) },
      orderBy: { createdAt: 'asc' },
      include: {
        items: true,
        order: { select: { orderNumber: true, type: true, table: { select: { label: true } } } },
      },
    });
  }

  async setStatus(ticketId: string, status: KitchenStatusValue, user: { id: string; clientId: string }) {
    const ticket = await this.prisma.kitchenTicket.findFirst({
      where: { id: ticketId, clientId: user.clientId },
      include: { items: { select: { orderItemId: true } } },
    });
    if (!ticket) throw new NotFoundException({ message: 'Ticket not found', code: 'TICKET_NOT_FOUND' });

    const orderItemIds = ticket.items.map((i) => i.orderItemId);
    const itemStatus = status === 'BUMPED' ? 'SERVED' : status === 'READY' ? 'READY' : status === 'PREPARING' ? 'PREPARING' : 'SENT';

    await this.prisma.$transaction(async (tx) => {
      await tx.kitchenTicket.update({
        where: { id: ticketId },
        data: { status: status as never, bumpedAt: status === 'BUMPED' ? new Date() : null },
      });
      await tx.kitchenTicketItem.updateMany({ where: { ticketId }, data: { status: itemStatus as never } });
      if (orderItemIds.length) {
        await tx.fnbOrderItem.updateMany({ where: { id: { in: orderItemIds } }, data: { status: itemStatus as never } });
      }
    });

    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.kitchen.status', entity: 'KitchenTicket', entityId: ticketId, newValue: { status } });
    return this.prisma.kitchenTicket.findUnique({ where: { id: ticketId }, include: { items: true } });
  }
}
