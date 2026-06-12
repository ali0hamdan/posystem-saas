import { BusinessType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PatchSaasClientSubscriptionDto } from './patch-saas-client-subscription.dto';
import { NotHybrid } from '../../common/validators/not-hybrid.validator';

export class PatchSaasClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, digits, and single hyphens',
  })
  slug?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(200)
  email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsEnum(BusinessType)
  @NotHybrid()
  businessType?: BusinessType;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  notes?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  supportNotes?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PatchSaasClientSubscriptionDto)
  subscription?: PatchSaasClientSubscriptionDto;
}
