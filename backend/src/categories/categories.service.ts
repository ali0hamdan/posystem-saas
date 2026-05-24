import {
  ConflictException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import {
  CreateCategoryDto,
  ListCategoriesQueryDto,
  UpdateCategoryDto,
} from './dto/category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  async findAll(query: ListCategoriesQueryDto, role: UserRole, clientId: string) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const canSeeInactive =
      (role === UserRole.OWNER || role === UserRole.ADMIN) &&
      query.includeInactive === true;

    const where = {
      clientId,
      ...(canSeeInactive ? {} : { isActive: true }),
      ...(query.q
        ? {
            name: { contains: query.q, mode: 'insensitive' as const },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findOne(id: string, role: UserRole, clientId: string) {
    const cat = await this.prisma.category.findFirst({ where: { id, clientId } });
    if (!cat) {
      throw new NotFoundException({ message: 'Category not found', code: 'CATEGORY_NOT_FOUND' });
    }
    if (!cat.isActive && role === UserRole.CASHIER) {
      throw new NotFoundException({ message: 'Category not found', code: 'CATEGORY_NOT_FOUND' });
    }
    return cat;
  }

  async create(dto: CreateCategoryDto, userId: string, clientId: string) {
    try {
      const created = await this.prisma.category.create({
        data: {
          clientId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          isActive: dto.isActive ?? true,
        },
      });
      await this.audit.log({
        userId,
        clientId,
        action: 'category.create',
        entity: 'Category',
        entityId: created.id,
        newValue: created,
      });
      return created;
    } catch (err) {
      this.handlePrisma(err);
      throw err;
    }
  }

  async update(id: string, dto: UpdateCategoryDto, userId: string, clientId: string) {
    const existing = await this.prisma.category.findFirst({ where: { id, clientId } });
    if (!existing) {
      throw new NotFoundException({ message: 'Category not found', code: 'CATEGORY_NOT_FOUND' });
    }
    const data = {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined
        ? { description: dto.description?.trim() ?? null }
        : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };

    if (Object.keys(data).length === 0) {
      throw new BadRequestException({
        message: 'No updatable fields provided',
        code: 'EMPTY_UPDATE',
      });
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data,
    });
    await this.audit.log({
      userId,
      clientId,
      action: 'category.update',
      entity: 'Category',
      entityId: id,
      oldValue: existing,
      newValue: updated,
    });
    return updated;
  }

  async softDelete(id: string, userId: string, clientId: string) {
    const existing = await this.prisma.category.findFirst({ where: { id, clientId } });
    if (!existing) {
      throw new NotFoundException({ message: 'Category not found', code: 'CATEGORY_NOT_FOUND' });
    }
    const updated = await this.prisma.category.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.log({
      userId,
      clientId,
      action: 'category.soft_delete',
      entity: 'Category',
      entityId: id,
      oldValue: existing,
      newValue: updated,
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
