import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { LicensePlan, SubscriptionStatus } from '@prisma/client';

export class RenewLicenseDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  extendDays!: number;

  @IsOptional()
  @IsEnum(LicensePlan)
  plan?: LicensePlan;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;
}
