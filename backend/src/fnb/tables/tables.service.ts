import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import {
  CreateDiningAreaDto,
  ListDiningAreasQueryDto,
  UpdateDiningAreaDto,
} from './dto/dining-area.dto';
import {
  CreateTableDto,
  ListTablesQueryDto,
  TableStatusValue,
  UpdateTableDto,
} from './dto/table.dto';

const ACTIVE_ORDER_STATUSES = ['OPEN', 'SENT', 'READY', 'SERVED'];

@Injectable()
export class FnbTablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  private async assertBranch(clientId: string, branchId?: string): Promise<string> {
    if (!branchId) {
      throw new BadRequestException({ message: 'X-Branch-Id header is required', code: 'BRANCH_REQUIRED' });
    }
    const branch = await this.prisma.branch.findFirst({ where: { id: branchId, clientId, isActive: true }, select: { id: true } });
    if (!branch) throw new BadRequestException({ message: 'Invalid branch', code: 'INVALID_BRANCH' });
    return branchId;
  }

  // ── Dining areas ──────────────────────────────────────────────────────────
  async listAreas(clientId: string, branchId: string | undefined, query: ListDiningAreasQueryDto) {
    const bid = await this.assertBranch(clientId, branchId);
    return this.prisma.diningArea.findMany({
      where: { clientId, branchId: bid, ...(query.includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { tables: true } } },
    });
  }

  async createArea(dto: CreateDiningAreaDto, userId: string, clientId: string, branchId?: string) {
    const bid = await this.assertBranch(clientId, branchId);
    const created = await this.prisma.diningArea.create({
      data: { clientId, branchId: bid, name: dto.name.trim(), sortOrder: dto.sortOrder ?? 0, isActive: dto.isActive ?? true },
    });
    await this.audit.log({ userId, clientId, action: 'fnb.dining_area.create', entity: 'DiningArea', entityId: created.id, newValue: created });
    return created;
  }

  async updateArea(id: string, dto: UpdateDiningAreaDto, userId: string, clientId: string) {
    const existing = await this.prisma.diningArea.findFirst({ where: { id, clientId } });
    if (!existing) throw new NotFoundException({ message: 'Dining area not found', code: 'DINING_AREA_NOT_FOUND' });
    const data = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
    if (Object.keys(data).length === 0) throw new BadRequestException({ message: 'No updatable fields provided', code: 'EMPTY_UPDATE' });
    const updated = await this.prisma.diningArea.update({ where: { id }, data });
    await this.audit.log({ userId, clientId, action: 'fnb.dining_area.update', entity: 'DiningArea', entityId: id, oldValue: existing, newValue: updated });
    return updated;
  }

  /** Hard delete — blocked while the area still has tables. */
  async removeArea(id: string, userId: string, clientId: string) {
    const existing = await this.prisma.diningArea.findFirst({ where: { id, clientId } });
    if (!existing) throw new NotFoundException({ message: 'Dining area not found', code: 'DINING_AREA_NOT_FOUND' });
    const tableCount = await this.prisma.restaurantTable.count({ where: { diningAreaId: id, clientId } });
    if (tableCount > 0) {
      throw new BadRequestException({ message: 'This area still has tables. Move or delete them first.', code: 'AREA_HAS_TABLES' });
    }
    await this.prisma.diningArea.delete({ where: { id } });
    await this.audit.log({ userId, clientId, action: 'fnb.dining_area.delete', entity: 'DiningArea', entityId: id, oldValue: existing });
    return existing;
  }

  // ── Tables ────────────────────────────────────────────────────────────────
  async listTables(clientId: string, branchId: string | undefined, query: ListTablesQueryDto) {
    const bid = await this.assertBranch(clientId, branchId);
    return this.prisma.restaurantTable.findMany({
      where: {
        clientId, branchId: bid,
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.areaId ? { diningAreaId: query.areaId } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ label: 'asc' }],
      include: { diningArea: { select: { id: true, name: true } } },
    });
  }

  async createTable(dto: CreateTableDto, userId: string, clientId: string, branchId?: string) {
    const bid = await this.assertBranch(clientId, branchId);
    if (dto.diningAreaId) await this.assertAreaInBranch(clientId, bid, dto.diningAreaId);
    const label = dto.label.trim();

    // A row with this label may already exist (incl. a previously soft-deleted one).
    const existing = await this.prisma.restaurantTable.findFirst({ where: { clientId, branchId: bid, label } });
    if (existing && existing.isActive) {
      throw new ConflictException({ message: 'A table with this label already exists in this branch', code: 'TABLE_LABEL_TAKEN' });
    }

    const data = {
      seats: dto.seats ?? 2,
      diningAreaId: dto.diningAreaId ?? null,
      posX: dto.posX ?? null,
      posY: dto.posY ?? null,
      status: dto.status ?? 'AVAILABLE',
      isActive: true,
    };
    const table = existing
      ? await this.prisma.restaurantTable.update({ where: { id: existing.id }, data })
      : await this.prisma.restaurantTable.create({ data: { clientId, branchId: bid, label, ...data } });

    await this.audit.log({ userId, clientId, action: 'fnb.table.create', entity: 'RestaurantTable', entityId: table.id, newValue: table });
    return table;
  }

  async updateTable(id: string, dto: UpdateTableDto, userId: string, clientId: string) {
    const existing = await this.prisma.restaurantTable.findFirst({ where: { id, clientId } });
    if (!existing) throw new NotFoundException({ message: 'Table not found', code: 'TABLE_NOT_FOUND' });
    if (dto.diningAreaId) await this.assertAreaInBranch(clientId, existing.branchId, dto.diningAreaId);
    const data = {
      ...(dto.label !== undefined ? { label: dto.label.trim() } : {}),
      ...(dto.seats !== undefined ? { seats: dto.seats } : {}),
      ...(dto.diningAreaId !== undefined ? { diningAreaId: dto.diningAreaId ?? null } : {}),
      ...(dto.posX !== undefined ? { posX: dto.posX } : {}),
      ...(dto.posY !== undefined ? { posY: dto.posY } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
    if (Object.keys(data).length === 0) throw new BadRequestException({ message: 'No updatable fields provided', code: 'EMPTY_UPDATE' });
    try {
      const updated = await this.prisma.restaurantTable.update({ where: { id }, data });
      await this.audit.log({ userId, clientId, action: 'fnb.table.update', entity: 'RestaurantTable', entityId: id, oldValue: existing, newValue: updated });
      return updated;
    } catch (err) {
      this.handlePrisma(err);
      throw err;
    }
  }

  async setStatus(id: string, status: TableStatusValue, userId: string, clientId: string) {
    const existing = await this.prisma.restaurantTable.findFirst({ where: { id, clientId } });
    if (!existing) throw new NotFoundException({ message: 'Table not found', code: 'TABLE_NOT_FOUND' });
    const updated = await this.prisma.restaurantTable.update({ where: { id }, data: { status } });
    await this.audit.log({ userId, clientId, action: 'fnb.table.status', entity: 'RestaurantTable', entityId: id, oldValue: { status: existing.status }, newValue: { status } });
    return updated;
  }

  /** Hard delete — blocked while the table has open orders. */
  async removeTable(id: string, userId: string, clientId: string) {
    const existing = await this.prisma.restaurantTable.findFirst({ where: { id, clientId } });
    if (!existing) throw new NotFoundException({ message: 'Table not found', code: 'TABLE_NOT_FOUND' });
    const openOrders = await this.prisma.fnbOrder.count({ where: { tableId: id, status: { in: ACTIVE_ORDER_STATUSES as never[] } } });
    if (openOrders > 0) {
      throw new BadRequestException({ message: 'This table has open orders. Settle or cancel them first.', code: 'TABLE_HAS_ORDERS' });
    }
    await this.prisma.restaurantTable.delete({ where: { id } });
    await this.audit.log({ userId, clientId, action: 'fnb.table.delete', entity: 'RestaurantTable', entityId: id, oldValue: existing });
    return existing;
  }

  private async assertAreaInBranch(clientId: string, branchId: string, areaId: string) {
    const area = await this.prisma.diningArea.findFirst({ where: { id: areaId, clientId, branchId }, select: { id: true } });
    if (!area) throw new BadRequestException({ message: 'Dining area does not belong to this branch', code: 'INVALID_DINING_AREA' });
  }

  private handlePrisma(err: unknown): void {
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === 'P2002') {
      throw new ConflictException({ message: 'A table with this label already exists in this branch', code: 'TABLE_LABEL_TAKEN' });
    }
  }
}
