import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  CreateSupplierDto,
  ListSuppliersQueryDto,
  UpdateSupplierDto,
} from './dto/supplier.dto';

@Injectable()
export class SuppliersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: ListSuppliersQueryDto, clientId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      clientId,
      ...(query.includeInactive === true ? {} : { isActive: true }),
      ...(query.q
        ? {
            name: { contains: query.q.trim(), mode: 'insensitive' as const },
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findOne(id: string, clientId: string) {
    const row = await this.prisma.supplier.findFirst({ where: { id, clientId } });
    if (!row) {
      throw new NotFoundException({
        message: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    return row;
  }

  async create(dto: CreateSupplierDto, userId: string, clientId: string) {
    try {
      const created = await this.prisma.supplier.create({
        data: {
          clientId,
          name: dto.name.trim(),
          phone: dto.phone?.trim() || null,
          email: dto.email?.trim().toLowerCase() || null,
          address: dto.address?.trim() || null,
          isActive: dto.isActive ?? true,
        },
      });
      await this.audit.log({
        userId,
        clientId,
        action: 'supplier.create',
        entity: 'Supplier',
        entityId: created.id,
        newValue: { name: created.name, isActive: created.isActive },
      });
      return created;
    } catch (err) {
      this.handlePrisma(err);
      throw err;
    }
  }

  async update(id: string, dto: UpdateSupplierDto, userId: string, clientId: string) {
    const existing = await this.prisma.supplier.findFirst({ where: { id, clientId } });
    if (!existing) {
      throw new NotFoundException({
        message: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }

    const data = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone?.trim() || null } : {}),
      ...(dto.email !== undefined
        ? { email: dto.email?.trim().toLowerCase() || null }
        : {}),
      ...(dto.address !== undefined ? { address: dto.address?.trim() || null } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        message: 'No updatable fields provided',
        code: 'EMPTY_UPDATE',
      });
    }

    try {
      const updated = await this.prisma.supplier.update({
        where: { id },
        data,
      });
      await this.audit.log({
        userId,
        clientId,
        action: 'supplier.update',
        entity: 'Supplier',
        entityId: id,
        oldValue: { name: existing.name, isActive: existing.isActive },
        newValue: { name: updated.name, isActive: updated.isActive },
      });
      return updated;
    } catch (err) {
      this.handlePrisma(err);
      throw err;
    }
  }

  async softDelete(id: string, userId: string, clientId: string) {
    const existing = await this.prisma.supplier.findFirst({ where: { id, clientId } });
    if (!existing) {
      throw new NotFoundException({
        message: 'Supplier not found',
        code: 'SUPPLIER_NOT_FOUND',
      });
    }
    const updated = await this.prisma.supplier.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      userId,
      clientId,
      action: 'supplier.soft_delete',
      entity: 'Supplier',
      entityId: id,
      oldValue: { name: existing.name, isActive: existing.isActive },
      newValue: { name: updated.name, isActive: updated.isActive },
    });
    return updated;
  }

  private handlePrisma(err: unknown): void {
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new ConflictException({
        message: 'A record with this value already exists',
        code: 'UNIQUE_VIOLATION',
      });
    }
  }
}
