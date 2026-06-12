import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BillingCycle, BusinessType, LicensePlan } from '@prisma/client';
import { NotHybrid } from '../../common/validators/not-hybrid.validator';

export class RegisterClientDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  businessName!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  ownerName!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsEnum(LicensePlan)
  planCode!: LicensePlan;

  @IsEnum(BillingCycle)
  billingCycle!: BillingCycle;

  @IsOptional()
  @IsEnum(BusinessType)
  @NotHybrid()
  businessType?: BusinessType;
}
