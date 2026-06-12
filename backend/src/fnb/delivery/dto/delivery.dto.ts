import { DeliveryAssignmentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateDeliveryDto {
  @IsUUID()
  orderId!: string;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  driverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  driverPhone?: string;
}

export class UpdateDeliveryDto {
  @IsOptional()
  @IsEnum(DeliveryAssignmentStatus)
  status?: DeliveryAssignmentStatus;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  driverName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  driverPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  failureReason?: string;
}

export class ListDeliveryQueryDto {
  @IsOptional()
  @IsEnum(DeliveryAssignmentStatus)
  status?: DeliveryAssignmentStatus;

  @IsOptional()
  @IsUUID()
  driverId?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number;
}
