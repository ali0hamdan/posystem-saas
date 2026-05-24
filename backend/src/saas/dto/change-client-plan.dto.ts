import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LicensePlan } from '@prisma/client';

export class ChangeClientPlanDto {
  @IsEnum(LicensePlan)
  planCode!: LicensePlan;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  graceDays?: number;
}
