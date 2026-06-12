import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { CreateMenuItemDto, ListMenuItemsQueryDto, UpdateMenuItemDto } from './dto/menu-item.dto';
import { CreateModifierGroupDto, ListModifierGroupsQueryDto, UpdateModifierGroupDto } from './dto/modifier-group.dto';

@Injectable()
export class FnbMenuService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  // ── Menu items ──────────────────────────────────────────────────────────
  async listItems(clientId: string, query: ListMenuItemsQueryDto) {
    return this.prisma.menuItem.findMany({
      where: {
        clientId,
        ...(query.includeInactive ? {} : { isActive: true }),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.q ? { name: { contains: query.q, mode: 'insensitive' as const } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { modifierGroups: { select: { modifierGroupId: true, sortOrder: true } } },
    });
  }

  async createItem(dto: CreateMenuItemDto, userId: string, clientId: string) {
    if (dto.modifierGroupIds?.length) await this.assertGroups(clientId, dto.modifierGroupIds);
    const created = await this.prisma.menuItem.create({
      data: {
        clientId,
        name: dto.name.trim(),
        price: dto.price,
        description: dto.description?.trim() ?? null,
        categoryId: dto.categoryId ?? null,
        productId: dto.productId ?? null,
        prepStation: dto.prepStation?.trim() || 'KITCHEN',
        isAvailable: dto.isAvailable ?? true,
        sortOrder: dto.sortOrder ?? 0,
        modifierGroups: dto.modifierGroupIds?.length
          ? { create: dto.modifierGroupIds.map((id, i) => ({ modifierGroupId: id, sortOrder: i })) }
          : undefined,
      },
      include: { modifierGroups: true },
    });
    await this.audit.log({ userId, clientId, action: 'fnb.menu_item.create', entity: 'MenuItem', entityId: created.id, newValue: created });
    return created;
  }

  async updateItem(id: string, dto: UpdateMenuItemDto, userId: string, clientId: string) {
    const existing = await this.prisma.menuItem.findFirst({ where: { id, clientId } });
    if (!existing) throw new NotFoundException({ message: 'Menu item not found', code: 'MENU_ITEM_NOT_FOUND' });
    if (dto.modifierGroupIds) await this.assertGroups(clientId, dto.modifierGroupIds);

    const data = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.price !== undefined ? { price: dto.price } : {}),
      ...(dto.description !== undefined ? { description: dto.description?.trim() ?? null } : {}),
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId ?? null } : {}),
      ...(dto.productId !== undefined ? { productId: dto.productId ?? null } : {}),
      ...(dto.prepStation !== undefined ? { prepStation: dto.prepStation?.trim() || 'KITCHEN' } : {}),
      ...(dto.isAvailable !== undefined ? { isAvailable: dto.isAvailable } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    };

    if (dto.modifierGroupIds) {
      await this.prisma.$transaction([
        this.prisma.menuItemModifierGroup.deleteMany({ where: { menuItemId: id } }),
        ...dto.modifierGroupIds.map((gid, i) =>
          this.prisma.menuItemModifierGroup.create({ data: { menuItemId: id, modifierGroupId: gid, sortOrder: i } }),
        ),
        this.prisma.menuItem.update({ where: { id }, data }),
      ]);
    } else if (Object.keys(data).length > 0) {
      await this.prisma.menuItem.update({ where: { id }, data });
    }

    const updated = await this.prisma.menuItem.findUnique({ where: { id }, include: { modifierGroups: true } });
    await this.audit.log({ userId, clientId, action: 'fnb.menu_item.update', entity: 'MenuItem', entityId: id, oldValue: existing, newValue: updated ?? undefined });
    return updated;
  }

  async removeItem(id: string, userId: string, clientId: string) {
    const existing = await this.prisma.menuItem.findFirst({ where: { id, clientId } });
    if (!existing) throw new NotFoundException({ message: 'Menu item not found', code: 'MENU_ITEM_NOT_FOUND' });
    const updated = await this.prisma.menuItem.update({ where: { id }, data: { isActive: false } });
    await this.audit.log({ userId, clientId, action: 'fnb.menu_item.soft_delete', entity: 'MenuItem', entityId: id, oldValue: existing, newValue: updated ?? undefined });
    return updated;
  }

  // ── Modifier groups ─────────────────────────────────────────────────────
  async listGroups(clientId: string, query: ListModifierGroupsQueryDto) {
    return this.prisma.modifierGroup.findMany({
      where: { clientId, ...(query.includeInactive ? {} : { isActive: true }) },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { modifiers: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  async createGroup(dto: CreateModifierGroupDto, userId: string, clientId: string) {
    const created = await this.prisma.modifierGroup.create({
      data: {
        clientId,
        name: dto.name.trim(),
        minSelect: dto.minSelect ?? 0,
        maxSelect: dto.maxSelect ?? 1,
        required: dto.required ?? false,
        sortOrder: dto.sortOrder ?? 0,
        modifiers: dto.modifiers?.length
          ? { create: dto.modifiers.map((m, i) => ({ clientId, name: m.name.trim(), priceDelta: m.priceDelta ?? 0, sortOrder: m.sortOrder ?? i })) }
          : undefined,
      },
      include: { modifiers: true },
    });
    await this.audit.log({ userId, clientId, action: 'fnb.modifier_group.create', entity: 'ModifierGroup', entityId: created.id, newValue: created });
    return created;
  }

  async updateGroup(id: string, dto: UpdateModifierGroupDto, userId: string, clientId: string) {
    const existing = await this.prisma.modifierGroup.findFirst({ where: { id, clientId } });
    if (!existing) throw new NotFoundException({ message: 'Modifier group not found', code: 'MODIFIER_GROUP_NOT_FOUND' });

    const data = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.minSelect !== undefined ? { minSelect: dto.minSelect } : {}),
      ...(dto.maxSelect !== undefined ? { maxSelect: dto.maxSelect } : {}),
      ...(dto.required !== undefined ? { required: dto.required } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
    };

    if (dto.modifiers) {
      await this.prisma.$transaction([
        this.prisma.modifier.deleteMany({ where: { groupId: id } }),
        ...dto.modifiers.map((m, i) =>
          this.prisma.modifier.create({ data: { clientId, groupId: id, name: m.name.trim(), priceDelta: m.priceDelta ?? 0, sortOrder: m.sortOrder ?? i } }),
        ),
        ...(Object.keys(data).length > 0 ? [this.prisma.modifierGroup.update({ where: { id }, data })] : []),
      ]);
    } else if (Object.keys(data).length > 0) {
      await this.prisma.modifierGroup.update({ where: { id }, data });
    }

    const updated = await this.prisma.modifierGroup.findUnique({ where: { id }, include: { modifiers: { orderBy: { sortOrder: 'asc' } } } });
    await this.audit.log({ userId, clientId, action: 'fnb.modifier_group.update', entity: 'ModifierGroup', entityId: id, oldValue: existing, newValue: updated ?? undefined });
    return updated;
  }

  async removeGroup(id: string, userId: string, clientId: string) {
    const existing = await this.prisma.modifierGroup.findFirst({ where: { id, clientId } });
    if (!existing) throw new NotFoundException({ message: 'Modifier group not found', code: 'MODIFIER_GROUP_NOT_FOUND' });
    const updated = await this.prisma.modifierGroup.update({ where: { id }, data: { isActive: false } });
    await this.audit.log({ userId, clientId, action: 'fnb.modifier_group.soft_delete', entity: 'ModifierGroup', entityId: id, oldValue: existing, newValue: updated ?? undefined });
    return updated;
  }

  private async assertGroups(clientId: string, ids: string[]) {
    const unique = [...new Set(ids)];
    const found = await this.prisma.modifierGroup.count({ where: { clientId, id: { in: unique }, isActive: true } });
    if (found !== unique.length) {
      throw new BadRequestException({ message: 'One or more modifier groups are invalid', code: 'INVALID_MODIFIER_GROUP' });
    }
  }
}
