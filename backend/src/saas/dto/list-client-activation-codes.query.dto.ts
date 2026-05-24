import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { ActivationCodeStatus } from '@prisma/client';

export class ListClientActivationCodesQueryDto {
  @IsOptional()
  @IsEnum(ActivationCodeStatus)
  status?: ActivationCodeStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
