import { Type } from 'class-transformer';
import {
  IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength,
} from 'class-validator';

export const TABLE_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_SERVICE'] as const;
export type TableStatusValue = (typeof TABLE_STATUSES)[number];

export class ListTablesQueryDto {
  @IsOptional() @IsUUID()
  areaId?: string;

  @IsOptional() @IsIn(TABLE_STATUSES)
  status?: TableStatusValue;

  @IsOptional() @Type(() => Boolean) @IsBoolean()
  includeInactive?: boolean;
}

export class CreateTableDto {
  @IsString() @IsNotEmpty() @MinLength(1) @MaxLength(60)
  label!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  seats?: number;

  @IsOptional() @IsUUID()
  diningAreaId?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000)
  posX?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000)
  posY?: number;

  @IsOptional() @IsIn(TABLE_STATUSES)
  status?: TableStatusValue;
}

export class UpdateTableDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(60)
  label?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  seats?: number;

  @IsOptional() @IsUUID()
  diningAreaId?: string | null;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000)
  posX?: number;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000)
  posY?: number;

  @IsOptional() @Type(() => Boolean) @IsBoolean()
  isActive?: boolean;
}

export class UpdateTableStatusDto {
  @IsIn(TABLE_STATUSES)
  status!: TableStatusValue;
}
