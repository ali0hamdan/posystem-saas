import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../audit/audit-log.service';
import {
  CreateReservationDto, ListReservationsQueryDto, ReservationStatusValue, UpdateReservationDto,
} from './dto/reservation.dto';

@Injectable()
export class FnbReservationsService {
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

  private async assertTable(clientId: string, branchId: string, tableId: string) {
    const t = await this.prisma.restaurantTable.findFirst({ where: { id: tableId, clientId, branchId }, select: { id: true } });
    if (!t) throw new BadRequestException({ message: 'Invalid table', code: 'INVALID_TABLE' });
  }

  private dayRange(date: string) {
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(`${date}T23:59:59.999Z`);
    return { gte: start, lte: end };
  }

  async list(clientId: string, branchId: string | undefined, query: ListReservationsQueryDto) {
    const bid = await this.assertBranch(clientId, branchId);
    return this.prisma.reservation.findMany({
      where: {
        clientId, branchId: bid,
        ...(query.date ? { reservedAt: this.dayRange(query.date) } : {}),
        ...(query.status ? { status: query.status as never } : {}),
      },
      orderBy: { reservedAt: 'asc' },
      include: { table: { select: { id: true, label: true } } },
    });
  }

  async create(dto: CreateReservationDto, user: { id: string; clientId: string }, branchId?: string) {
    const bid = await this.assertBranch(user.clientId, branchId);
    if (dto.tableId) await this.assertTable(user.clientId, bid, dto.tableId);
    const created = await this.prisma.reservation.create({
      data: {
        clientId: user.clientId, branchId: bid,
        customerName: dto.customerName.trim(), customerPhone: dto.customerPhone?.trim() ?? null,
        partySize: dto.partySize, reservedAt: new Date(dto.reservedAt),
        durationMin: dto.durationMin ?? 90, tableId: dto.tableId ?? null,
        notes: dto.notes?.trim() ?? null, createdById: user.id, status: 'PENDING' as never,
      },
      include: { table: { select: { id: true, label: true } } },
    });
    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.reservation.create', entity: 'Reservation', entityId: created.id, newValue: { customerName: created.customerName, reservedAt: dto.reservedAt } });
    return created;
  }

  async update(id: string, dto: UpdateReservationDto, user: { id: string; clientId: string }) {
    const existing = await this.prisma.reservation.findFirst({ where: { id, clientId: user.clientId } });
    if (!existing) throw new NotFoundException({ message: 'Reservation not found', code: 'RESERVATION_NOT_FOUND' });
    if (dto.tableId) await this.assertTable(user.clientId, existing.branchId, dto.tableId);
    const data = {
      ...(dto.customerName !== undefined ? { customerName: dto.customerName.trim() } : {}),
      ...(dto.customerPhone !== undefined ? { customerPhone: dto.customerPhone?.trim() ?? null } : {}),
      ...(dto.partySize !== undefined ? { partySize: dto.partySize } : {}),
      ...(dto.reservedAt !== undefined ? { reservedAt: new Date(dto.reservedAt) } : {}),
      ...(dto.durationMin !== undefined ? { durationMin: dto.durationMin } : {}),
      ...(dto.tableId !== undefined ? { tableId: dto.tableId ?? null } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes?.trim() ?? null } : {}),
    };
    if (Object.keys(data).length === 0) throw new BadRequestException({ message: 'No updatable fields provided', code: 'EMPTY_UPDATE' });
    const updated = await this.prisma.reservation.update({ where: { id }, data, include: { table: { select: { id: true, label: true } } } });
    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.reservation.update', entity: 'Reservation', entityId: id, oldValue: existing, newValue: updated });
    return updated;
  }

  async setStatus(id: string, status: ReservationStatusValue, user: { id: string; clientId: string }) {
    const existing = await this.prisma.reservation.findFirst({ where: { id, clientId: user.clientId } });
    if (!existing) throw new NotFoundException({ message: 'Reservation not found', code: 'RESERVATION_NOT_FOUND' });
    const updated = await this.prisma.reservation.update({ where: { id }, data: { status: status as never }, include: { table: { select: { id: true, label: true } } } });
    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.reservation.status', entity: 'Reservation', entityId: id, newValue: { status } });
    return updated;
  }

  async remove(id: string, user: { id: string; clientId: string }) {
    const existing = await this.prisma.reservation.findFirst({ where: { id, clientId: user.clientId } });
    if (!existing) throw new NotFoundException({ message: 'Reservation not found', code: 'RESERVATION_NOT_FOUND' });
    await this.prisma.reservation.delete({ where: { id } });
    await this.audit.log({ userId: user.id, clientId: user.clientId, action: 'fnb.reservation.delete', entity: 'Reservation', entityId: id, oldValue: existing });
    return existing;
  }
}
