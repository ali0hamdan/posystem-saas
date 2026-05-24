import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';
import { LicensePlan } from '@prisma/client';

export class CreateActivationCodeDto {
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @IsEnum(LicensePlan)
  plan!: LicensePlan;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  termDays!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxBranches!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10_000)
  maxDevices!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  graceDays!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  maxUses!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  validDays!: number;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  label?: string;
}
