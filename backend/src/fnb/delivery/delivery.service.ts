import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryAssignmentStatus, Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import { SafeUser } from '../../auth/types/safe-user.type';
import { CreateDeliveryDto, ListDeliveryQueryDto, UpdateDeliveryDto } from './dto/delivery.dto';

@Injectable()
export class DeliveryService {
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

  async list(clientId: string, branchId: string | undefined, query: ListDeliveryQueryDto, user: SafeUser) {
    const bid = await this.assertBranch(clientId, branchId);
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 200);

    const baseWhere: Prisma.DeliveryAssignmentWhereInput = {
      clientId,
      branchId: bid,
      ...(query.status ? { status: query.status } : {}),
      ...(query.driverId ? { driverId: query.driverId } : {}),
    };

    // Delivery drivers only see their own assignments.
    const where: Prisma.DeliveryAssignmentWhereInput =
      user.role === UserRole.DELIVERY_DRIVER ? { ...baseWhere, driverId: user.id } : baseWhere;

    const [items, total] = await Promise.all([
      this.prisma.deliveryAssignment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.deliveryAssignment.count({ where }),
    ]);

    return {
      data: items,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 0 },
    };
  }

  async create(dto: CreateDeliveryDto, user: SafeUser, branchId?: string) {
    const bid = await this.assertBranch(user.clientId, branchId);

    const order = await this.prisma.fnbOrder.findFirst({
      where: { id: dto.orderId, clientId: user.clientId, branchId: bid },
      select: { id: true, type: true },
    });
    if (!order) throw new NotFoundException({ message: 'Order not found', code: 'ORDER_NOT_FOUND' });
    if (order.type !== 'DELIVERY') {
      throw new BadRequestException({ message: 'Only delivery orders can be assigned', code: 'ORDER_NOT_DELIVERY' });
    }

    if (dto.driverId) {
      const driver = await this.prisma.user.findFirst({
        where: { id: dto.driverId, clientId: user.clientId, isActive: true, role: UserRole.DELIVERY_DRIVER },
        select: { id: true },
      });
      if (!driver) throw new BadRequestException({ message: 'Invalid driver', code: 'INVALID_DRIVER' });
    }

    try {
      const row = await this.prisma.deliveryAssignment.create({
        data: {
          clientId: user.clientId,
          branchId: bid,
          orderId: dto.orderId,
          driverId: dto.driverId ?? null,
          driverName: dto.driverName?.trim() || null,
          driverPhone: dto.driverPhone?.trim() || null,
          status: dto.driverId ? DeliveryAssignmentStatus.ASSIGNED : DeliveryAssignmentStatus.PENDING,
          createdById: user.id,
        },
      });
      await this.audit.log({
        userId: user.id,
        clientId: user.clientId,
        action: 'fnb.delivery.create',
        entity: 'DeliveryAssignment',
        entityId: row.id,
        newValue: { orderId: row.orderId, driverId: row.driverId, status: row.status },
      });
      return row;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException({ message: 'This order already has a delivery assignment', code: 'DELIVERY_ALREADY_ASSIGNED' });
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateDeliveryDto, user: SafeUser) {
    const existing = await this.prisma.deliveryAssignment.findFirst({
      where: { id, clientId: user.clientId },
    });
    if (!existing) throw new NotFoundException({ message: 'Assignment not found', code: 'DELIVERY_NOT_FOUND' });

    if (user.role === UserRole.DELIVERY_DRIVER && existing.driverId !== user.id) {
      throw new ForbiddenException({ message: 'You can only update your own assignments', code: 'DELIVERY_NOT_OWNER' });
    }

    const data: Prisma.DeliveryAssignmentUpdateInput = {};
    if (dto.status !== undefined) {
      data.status = dto.status;
      if (dto.status === DeliveryAssignmentStatus.PICKED_UP) data.pickedUpAt = new Date();
      if (dto.status === DeliveryAssignmentStatus.DELIVERED) data.deliveredAt = new Date();
    }
    if (dto.driverId !== undefined) {
      const driver = await this.prisma.user.findFirst({
        where: { id: dto.driverId, clientId: user.clientId, isActive: true, role: UserRole.DELIVERY_DRIVER },
        select: { id: true },
      });
      if (!driver) throw new BadRequestException({ message: 'Invalid driver', code: 'INVALID_DRIVER' });
      data.driverId = dto.driverId;
    }
    if (dto.driverName !== undefined) data.driverName = dto.driverName.trim() || null;
    if (dto.driverPhone !== undefined) data.driverPhone = dto.driverPhone.trim() || null;
    if (dto.failureReason !== undefined) data.failureReason = dto.failureReason.trim() || null;

    const updated = await this.prisma.deliveryAssignment.update({ where: { id }, data });
    await this.audit.log({
      userId: user.id,
      clientId: user.clientId,
      action: 'fnb.delivery.update',
      entity: 'DeliveryAssignment',
      entityId: id,
      oldValue: { status: existing.status, driverId: existing.driverId },
      newValue: { status: updated.status, driverId: updated.driverId },
    });
    return updated;
  }

  async get(id: string, user: SafeUser) {
    const row = await this.prisma.deliveryAssignment.findFirst({
      where: { id, clientId: user.clientId },
    });
    if (!row) throw new NotFoundException({ message: 'Assignment not found', code: 'DELIVERY_NOT_FOUND' });
    if (user.role === UserRole.DELIVERY_DRIVER && row.driverId !== user.id) {
      throw new ForbiddenException({ message: 'You can only view your own assignments', code: 'DELIVERY_NOT_OWNER' });
    }
    return row;
  }
}
