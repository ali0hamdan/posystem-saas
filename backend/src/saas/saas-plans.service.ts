import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit/audit-log.service';
import type { SaasAdminSafe } from './strategies/saas-jwt.strategy';
import type { CreateSaasPlanDto } from './dto/create-saas-plan.dto';
import type { PatchSaasPlanDto } from './dto/patch-saas-plan.dto';

function definedKeys<T extends object>(obj: T): (keyof T)[] {
  return (Object.keys(obj) as (keyof T)[]).filter((k) => obj[k] !== undefined);
}

function toDecimalOrNull(v: number | null | undefined): Prisma.Decimal | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  return new Prisma.Decimal(v);
}

/**
 * Plan/Subscription max-* columns are `Int? @default(...)` in Prisma. The
 * generated client drops `null` from the create-input type, but the DB
 * column accepts `null` (= "unlimited", used by Desktop Lifetime plans).
 * This helper lets us pass `null` through without `any` at the call site.
 */
function nullableInt(v: number | null | undefined): number | undefined {
  if (v === undefined) return undefined;
  // Runtime value is null (correct); TS type stays number | undefined so
  // the Prisma generated input type is satisfied.
  return v as number | undefined;
}

@Injectable()
export class SaasPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  list() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  listAll() {
    return this.prisma.plan.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async create(admin: SaasAdminSafe, dto: CreateSaasPlanDto) {
    const existing = await this.prisma.plan.findUnique({ where: { code: dto.code } });
    if (existing) {
      throw new ConflictException({
        message: 'A plan with this code already exists',
        code: 'SAAS_PLAN_CODE_EXISTS',
      });
    }
    const row = await this.prisma.plan.create({
      data: {
        code: dto.code,
        name: dto.name.trim(),
        description: dto.description?.trim() ?? null,
        type: dto.type ?? 'SUBSCRIPTION',
        businessType: dto.businessType ?? null,
        monthlyPrice: toDecimalOrNull(dto.monthlyPrice),
        yearlyPrice: toDecimalOrNull(dto.yearlyPrice),
        oneTimePrice: toDecimalOrNull(dto.oneTimePrice),
        currency: dto.currency ?? 'USD',
        // Null = unlimited (Desktop Lifetime plans). The Prisma client's
        // generated input type drops `null` for these fields when the schema
        // has `@default(5)`, but the column is `Int?` and `null` is the
        // correct runtime value for "unlimited" — hence `nullableInt`.
        maxUsers: nullableInt(dto.maxUsers),
        maxBranches: nullableInt(dto.maxBranches),
        maxDevices: nullableInt(dto.maxDevices),
        features: (dto.features ?? {}) as Prisma.InputJsonValue,
        allowsDesktopDownload: dto.allowsDesktopDownload ?? false,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.plan.create',
      entity: 'Plan',
      entityId: row.id,
      newValue: { code: dto.code, saasAdminId: admin.id },
    });
    return row;
  }

  async patch(admin: SaasAdminSafe, id: string, dto: PatchSaasPlanDto) {
    const keys = definedKeys(dto);
    if (keys.length === 0) {
      throw new BadRequestException({ message: 'No fields to update', code: 'EMPTY_UPDATE' });
    }
    const existing = await this.prisma.plan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({ message: 'Plan not found', code: 'PLAN_NOT_FOUND' });
    }
    const updated = await this.prisma.plan.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() ?? null } : {}),
        ...(dto.type !== undefined ? { type: dto.type } : {}),
        ...(dto.businessType !== undefined ? { businessType: dto.businessType } : {}),
        ...(dto.monthlyPrice !== undefined ? { monthlyPrice: toDecimalOrNull(dto.monthlyPrice) } : {}),
        ...(dto.yearlyPrice !== undefined ? { yearlyPrice: toDecimalOrNull(dto.yearlyPrice) } : {}),
        ...(dto.oneTimePrice !== undefined ? { oneTimePrice: toDecimalOrNull(dto.oneTimePrice) } : {}),
        ...(dto.currency !== undefined ? { currency: dto.currency } : {}),
        ...(dto.maxUsers !== undefined ? { maxUsers: dto.maxUsers } : {}),
        ...(dto.maxBranches !== undefined ? { maxBranches: dto.maxBranches } : {}),
        ...(dto.maxDevices !== undefined ? { maxDevices: dto.maxDevices } : {}),
        ...(dto.features !== undefined ? { features: dto.features as Prisma.InputJsonValue } : {}),
        ...(dto.allowsDesktopDownload !== undefined ? { allowsDesktopDownload: dto.allowsDesktopDownload } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    await this.audit.log({
      userId: null,
      clientId: null,
      action: 'saas.plan.update',
      entity: 'Plan',
      entityId: id,
      oldValue: { name: existing.name },
      newValue: { saasAdminId: admin.id, fields: keys },
    });
    return updated;
  }
}
