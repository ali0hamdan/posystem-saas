import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { SettingsService } from '../../settings/settings.service';
import { StockService } from '../../stock/stock.service';
import { NotificationService } from '../../notifications/notification.service';
import { AddOrderItemDto, ListOrdersQueryDto, OpenOrderDto, SettleOrderDto, UpdateDeliveryDto } from './dto/order.dto';

const D = (v: Prisma.Decimal.Value) => new Prisma.Decimal(v);
const ORDER_INCLUDE = {
  items: { include: { modifiers: true }, orderBy: { createdAt: 'asc' as const } },
  table: { select: { id: true, label: true } },
} satisfies Prisma.FnbOrderInclude;

@Injectable()
export class FnbOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly settings: SettingsService,
    private readonly stock: StockService,
    private readonly notifications: NotificationService,
  ) {}

  private async assertBranch(clientId: string, branchId?: string): Promise<string> {
    if (!branchId) throw new BadRequestException({ message: 'X-Branch-Id header is required', code: 'BRANCH_REQUIRED' });
    const b = await this.prisma.branch.findFirst({ where: { id: branchId, clientId, isActive: true }, select: { id: true } });
    if (!b) throw new BadRequestException({ message: 'Invalid branch', code: 'INVALID_BRANCH' });
    return branchId;
  }

  private orderNumber(): string {
    return `ORD-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  }

  async list(clientId: string, branchId: string | undefined, query: ListOrdersQueryDto) {
    const bid = await this.assertBranch(clientId, branchId);
    return this.prisma.fnbOrder.findMany({
      where: { clientId, branchId: bid, ...(query.status ? { status: query.status as never } : {}), ...(query.tableId ? { tableId: query.tableId } : {}) },
      orderBy: { openedAt: 'desc' },
      include: ORDER_INCLUDE,
    });
  }

  async get(id: string, clientId: string) {
    const order = await this.prisma.fnbOrder.findFirst({ where: { id, clientId }, include: ORDER_INCLUDE });
    if (!order) throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    return order;
  }

  async open(dto: OpenOrderDto, user: { id: string; clientId: string }, branchId?: string) {
    const bid = await this.assertBranch(user.clientId, branchId);
    if (dto.type === 'DINE_IN') {
      if (!dto.tableId) throw new BadRequestException({ message: 'A table is required for dine-in orders', code: 'TABLE_REQUIRED' });
      const table = await this.prisma.restaurantTable.findFirst({ where: { id: dto.tableId, clientId: user.clientId, branchId: bid } });
      if (!table) throw new BadRequestException({ message: 'Invalid table', code: 'INVALID_TABLE' });
    }
    const order = await this.prisma.$transaction(async (tx) => {
      const created = await tx.fnbOrder.create({
        data: {
          clientId: user.clientId, branchId: bid, orderNumber: this.orderNumber(),
          type: dto.type as never, status: 'OPEN' as never,
          tableId: dto.type === 'DINE_IN' ? dto.tableId! : null,
          customerId: dto.customerId ?? null, serverId: user.id,
          guestCount: dto.guestCount ?? 1, notes: dto.notes?.trim() ?? null,
          deliveryAddress: dto.type === 'DELIVERY' ? (dto.deliveryAddress?.trim() ?? null) : null,
          deliveryPhone: dto.type === 'DELIVERY' ? (dto.deliveryPhone?.trim() ?? null) : null,
        },
      });
      if (dto.type === 'DINE_IN' && dto.tableId) {
        await tx.restaurantTable.update({ where: { id: dto.tableId }, data: { status: 'OCCUPIED' as never } });
      }
      return created;
    });
    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.order.open', entity: 'FnbOrder', entityId: order.id, newValue: { orderNumber: order.orderNumber, type: order.type } });
    return this.get(order.id, user.clientId);
  }

  async addItem(orderId: string, dto: AddOrderItemDto, user: { id: string; clientId: string }) {
    const order = await this.getOpen(orderId, user.clientId);
    const menuItem = await this.prisma.menuItem.findFirst({ where: { id: dto.menuItemId, clientId: user.clientId, isActive: true } });
    if (!menuItem) throw new BadRequestException({ message: 'Menu item not found', code: 'MENU_ITEM_NOT_FOUND' });

    let mods: { id: string; name: string; priceDelta: Prisma.Decimal }[] = [];
    if (dto.modifierIds?.length) {
      mods = await this.prisma.modifier.findMany({ where: { id: { in: dto.modifierIds }, clientId: user.clientId, isActive: true }, select: { id: true, name: true, priceDelta: true } });
      if (mods.length !== new Set(dto.modifierIds).size) {
        throw new BadRequestException({ message: 'One or more modifiers are invalid', code: 'INVALID_MODIFIER' });
      }
    }

    const qty = dto.quantity ?? 1;
    const modifiersTotal = mods.reduce((s, m) => s.add(D(m.priceDelta)), D(0));
    const unitPrice = D(menuItem.price);
    const lineTotal = unitPrice.add(modifiersTotal).mul(qty);

    await this.prisma.fnbOrderItem.create({
      data: {
        clientId: user.clientId, orderId, menuItemId: menuItem.id, name: menuItem.name,
        quantity: qty, unitPrice, modifiersTotal, lineTotal, status: 'PENDING' as never,
        notes: dto.notes?.trim() ?? null,
        modifiers: mods.length ? { create: mods.map((m) => ({ modifierId: m.id, name: m.name, priceDelta: m.priceDelta })) } : undefined,
      },
    });
    await this.recompute(orderId, user.clientId);
    return this.get(orderId, user.clientId);
  }

  async updateItem(orderId: string, itemId: string, quantity: number, user: { id: string; clientId: string }) {
    await this.getOpen(orderId, user.clientId);
    const item = await this.prisma.fnbOrderItem.findFirst({ where: { id: itemId, orderId, clientId: user.clientId } });
    if (!item) throw new NotFoundException({ message: 'Order item not found', code: 'ORDER_ITEM_NOT_FOUND' });
    const unit = D(item.unitPrice).add(D(item.modifiersTotal));
    await this.prisma.fnbOrderItem.update({ where: { id: itemId }, data: { quantity, lineTotal: unit.mul(quantity) } });
    await this.recompute(orderId, user.clientId);
    return this.get(orderId, user.clientId);
  }

  async removeItem(orderId: string, itemId: string, user: { id: string; clientId: string }) {
    await this.getOpen(orderId, user.clientId);
    const item = await this.prisma.fnbOrderItem.findFirst({ where: { id: itemId, orderId, clientId: user.clientId } });
    if (!item) throw new NotFoundException({ message: 'Order item not found', code: 'ORDER_ITEM_NOT_FOUND' });
    await this.prisma.fnbOrderItem.delete({ where: { id: itemId } });
    await this.recompute(orderId, user.clientId);
    return this.get(orderId, user.clientId);
  }

  async sendToKitchen(orderId: string, user: { id: string; clientId: string }) {
    const order = await this.getOpen(orderId, user.clientId);
    const pending = await this.prisma.fnbOrderItem.findMany({ where: { orderId, clientId: user.clientId, status: 'PENDING' as never } });
    if (pending.length === 0) throw new BadRequestException({ message: 'Nothing new to send to the kitchen', code: 'NOTHING_TO_SEND' });

    await this.prisma.$transaction(async (tx) => {
      const ticket = await tx.kitchenTicket.create({
        data: {
          clientId: user.clientId, branchId: order.branchId, orderId,
          ticketNumber: `K-${Date.now().toString(36).toUpperCase().slice(-5)}`, status: 'QUEUED' as never,
          items: { create: pending.map((p) => ({ orderItemId: p.id, name: p.name, quantity: p.quantity, status: 'SENT' as never })) },
        },
      });
      await tx.fnbOrderItem.updateMany({ where: { id: { in: pending.map((p) => p.id) } }, data: { status: 'SENT' as never, sentAt: new Date() } });
      if (order.status === 'OPEN') await tx.fnbOrder.update({ where: { id: orderId }, data: { status: 'SENT' as never } });
      return ticket;
    });
    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.order.send_kitchen', entity: 'FnbOrder', entityId: orderId, newValue: { items: pending.length } });
    return this.get(orderId, user.clientId);
  }

  async settle(orderId: string, dto: SettleOrderDto, user: { id: string; clientId: string }) {
    const order = await this.get(orderId, user.clientId);
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new BadRequestException({ message: 'Order is already closed', code: 'ORDER_CLOSED' });
    }
    await this.recompute(orderId, user.clientId, dto.discount);
    await this.prisma.$transaction(async (tx) => {
      await tx.fnbOrder.update({ where: { id: orderId }, data: { status: 'COMPLETED' as never, closedAt: new Date() } });
      if (order.tableId) await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE' as never } });
    });
    await this.deductRecipeStock(order, user);
    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.order.settle', entity: 'FnbOrder', entityId: orderId, newValue: { paymentMethod: dto.paymentMethod ?? 'CASH' } });

    const settled = await this.get(orderId, user.clientId);
    void this.notifications
      .notifyPurchaseCompleted({
        clientId: user.clientId,
        invoiceNumber: settled.orderNumber,
        total: String(settled.total ?? 0),
        paymentMethod: dto.paymentMethod ?? 'CASH',
        linkPath: '/fnb/pos',
      })
      .catch(() => undefined);
    return settled;
  }

  async cancel(orderId: string, user: { id: string; clientId: string }) {
    const order = await this.get(orderId, user.clientId);
    if (order.status === 'COMPLETED') throw new BadRequestException({ message: 'Cannot cancel a completed order', code: 'ORDER_COMPLETED' });
    await this.prisma.$transaction(async (tx) => {
      await tx.fnbOrder.update({ where: { id: orderId }, data: { status: 'CANCELLED' as never, closedAt: new Date() } });
      if (order.tableId) await tx.restaurantTable.update({ where: { id: order.tableId }, data: { status: 'AVAILABLE' as never } });
    });
    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.order.cancel', entity: 'FnbOrder', entityId: orderId, newValue: {} });
    return this.get(orderId, user.clientId);
  }

  async updateDelivery(orderId: string, dto: UpdateDeliveryDto, user: { id: string; clientId: string }) {
    const existing = await this.prisma.fnbOrder.findFirst({ where: { id: orderId, clientId: user.clientId } });
    if (!existing) throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    const data = {
      ...(dto.driverName !== undefined ? { driverName: dto.driverName?.trim() || null } : {}),
      ...(dto.deliveryAddress !== undefined ? { deliveryAddress: dto.deliveryAddress?.trim() || null } : {}),
      ...(dto.deliveryPhone !== undefined ? { deliveryPhone: dto.deliveryPhone?.trim() || null } : {}),
    };
    if (Object.keys(data).length === 0) throw new BadRequestException({ message: 'No updatable fields provided', code: 'EMPTY_UPDATE' });
    await this.prisma.fnbOrder.update({ where: { id: orderId }, data });
    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.order.delivery', entity: 'FnbOrder', entityId: orderId, newValue: data });
    return this.get(orderId, user.clientId);
  }

  /** Best-effort: deduct recipe ingredients from stock when an order is settled. */
  private async deductRecipeStock(
    order: { id: string; branchId: string; orderNumber: string; items?: Array<{ menuItemId: string | null; quantity: number; status: string }> },
    user: { id: string; clientId: string },
  ) {
    const items = (order.items ?? []).filter((i) => i.menuItemId && i.status !== 'CANCELLED');
    if (!items.length) return;
    const menuItemIds = [...new Set(items.map((i) => i.menuItemId as string))];
    const recipes = await this.prisma.recipe.findMany({
      where: { menuItemId: { in: menuItemIds }, clientId: user.clientId, isActive: true },
      include: { ingredients: true },
    });
    if (!recipes.length) return;
    const byMenuItem = new Map(recipes.map((r) => [r.menuItemId, r]));
    const need = new Map<string, number>();
    for (const line of items) {
      const recipe = byMenuItem.get(line.menuItemId as string);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        need.set(ing.productId, (need.get(ing.productId) ?? 0) + Number(ing.quantity) * line.quantity);
      }
    }
    for (const [productId, raw] of need) {
      const qty = Math.round(raw);
      if (qty <= 0) continue;
      try {
        await this.stock.adjustStock({
          clientId: user.clientId, branchId: order.branchId, productId,
          quantityChange: -qty, type: 'SALE' as never,
          reason: `F&B order ${order.orderNumber}`, createdById: user.id,
          referenceType: 'fnb_order', referenceId: order.id, allowNegativeStock: true,
        });
      } catch {
        // ingredient not stocked in this branch — skip without blocking the sale
      }
    }
  }

  private async getOpen(orderId: string, clientId: string) {
    const order = await this.prisma.fnbOrder.findFirst({ where: { id: orderId, clientId } });
    if (!order) throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new BadRequestException({ message: 'Order is closed', code: 'ORDER_CLOSED' });
    }
    return order;
  }

  private async recompute(orderId: string, clientId: string, discount = 0) {
    const items = await this.prisma.fnbOrderItem.findMany({ where: { orderId, clientId, status: { not: 'CANCELLED' as never } }, select: { lineTotal: true } });
    const subtotal = items.reduce((s, i) => s.add(D(i.lineTotal)), D(0));
    const store = await this.settings.get(clientId);
    const rate = store?.taxEnabled ? D(store.taxRate) : D(0);
    const discountTotal = D(discount).gt(subtotal) ? subtotal : D(discount);
    const afterDiscount = subtotal.sub(discountTotal);
    const taxTotal = rate.gt(0) ? D(afterDiscount.mul(rate).div(100).toFixed(2)) : D(0);
    const total = afterDiscount.add(taxTotal);
    await this.prisma.fnbOrder.update({ where: { id: orderId }, data: { subtotal, discountTotal, taxTotal, total } });
  }
}
