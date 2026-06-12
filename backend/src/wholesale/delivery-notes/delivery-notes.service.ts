import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DeliveryNoteStatus, DocumentCounterType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DocumentNumberingService } from '../../common/services/document-numbering.service';
import { SettingsService } from '../../settings/settings.service';
import { SafeUser } from '../../auth/types/safe-user.type';
import { WholesaleScopeService } from '../wholesale-scope.service';
import {
  CreateDeliveryNoteDto,
  ListDeliveryNotesQueryDto,
  MarkDeliveredDto,
  UpdateDeliveryNoteDto,
} from './dto/delivery-note.dto';

@Injectable()
export class DeliveryNotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scope: WholesaleScopeService,
    private readonly numbering: DocumentNumberingService,
    private readonly settings: SettingsService,
  ) {}

  async list(clientId: string, branchId: string | undefined, query: ListDeliveryNotesQueryDto) {
    await this.scope.assertWholesaleBusiness(clientId);
    const where = {
      clientId,
      ...(branchId ? { branchId } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
    };
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 50, 100);
    const [data, total] = await Promise.all([
      this.prisma.deliveryNote.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { items: true },
      }),
      this.prisma.deliveryNote.count({ where }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
  }

  async get(id: string, clientId: string) {
    await this.scope.assertWholesaleBusiness(clientId);
    const row = await this.prisma.deliveryNote.findFirst({
      where: { id, clientId },
      include: { items: true },
    });
    if (!row) throw new NotFoundException('Delivery note not found');
    return row;
  }

  async create(dto: CreateDeliveryNoteDto, user: SafeUser, branchId?: string) {
    await this.scope.assertWholesaleBusiness(user.clientId);
    const bid = await this.scope.assertBranch(user.clientId, branchId);
    await this.scope.assertCustomer(user.clientId, dto.customerId);
    const storeSettings = await this.settings.get(user.clientId);
    const prefix = storeSettings.deliveryNotePrefix ?? 'DN';

    const products = await this.prisma.product.findMany({
      where: { id: { in: dto.items.map((i) => i.productId) }, clientId: user.clientId },
      select: { id: true, name: true },
    });
    if (products.length !== dto.items.length) {
      throw new BadRequestException({ message: 'One or more products not found', code: 'PRODUCT_NOT_FOUND' });
    }
    const nameById = Object.fromEntries(products.map((p) => [p.id, p.name]));

    return this.prisma.$transaction(async (tx) => {
      const deliveryNoteNumber = await this.numbering.nextNumber(
        user.clientId,
        DocumentCounterType.DELIVERY_NOTE,
        prefix,
        tx,
      );
      return tx.deliveryNote.create({
        data: {
          clientId: user.clientId,
          branchId: bid,
          customerId: dto.customerId,
          saleId: dto.saleId ?? null,
          proformaInvoiceId: dto.proformaInvoiceId ?? null,
          deliveryNoteNumber,
          driverName: dto.driverName?.trim() || null,
          vehicleNumber: dto.vehicleNumber?.trim() || null,
          deliveryAddress: dto.deliveryAddress?.trim() || null,
          notes: dto.notes?.trim() || null,
          createdById: user.id,
          items: {
            create: dto.items.map((i) => ({
              clientId: user.clientId,
              productId: i.productId,
              productNameSnapshot: nameById[i.productId],
              quantity: i.quantity,
              notes: i.notes?.trim() || null,
            })),
          },
        },
        include: { items: true },
      });
    });
  }

  async update(id: string, dto: UpdateDeliveryNoteDto, user: SafeUser) {
    const row = await this.get(id, user.clientId);
    if (row.status === DeliveryNoteStatus.DELIVERED || row.status === DeliveryNoteStatus.CANCELLED) {
      throw new BadRequestException({ message: 'Cannot edit delivered/cancelled note', code: 'INVALID_STATUS' });
    }
    return this.prisma.deliveryNote.update({
      where: { id },
      data: {
        ...(dto.driverName !== undefined ? { driverName: dto.driverName } : {}),
        ...(dto.vehicleNumber !== undefined ? { vehicleNumber: dto.vehicleNumber } : {}),
        ...(dto.deliveryAddress !== undefined ? { deliveryAddress: dto.deliveryAddress } : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      include: { items: true },
    });
  }

  async markDelivered(id: string, dto: MarkDeliveredDto, user: SafeUser) {
    const row = await this.get(id, user.clientId);
    if (row.status === DeliveryNoteStatus.CANCELLED) {
      throw new BadRequestException({ message: 'Cancelled note cannot be delivered', code: 'INVALID_STATUS' });
    }
    return this.prisma.deliveryNote.update({
      where: { id },
      data: {
        status: DeliveryNoteStatus.DELIVERED,
        deliveredAt: dto.deliveredAt ? new Date(dto.deliveredAt) : new Date(),
      },
      include: { items: true },
    });
  }

  async cancel(id: string, user: SafeUser) {
    const row = await this.get(id, user.clientId);
    if (row.status === DeliveryNoteStatus.DELIVERED) {
      throw new BadRequestException({ message: 'Delivered note cannot be cancelled', code: 'INVALID_STATUS' });
    }
    return this.prisma.deliveryNote.update({
      where: { id },
      data: { status: DeliveryNoteStatus.CANCELLED },
      include: { items: true },
    });
  }
}
