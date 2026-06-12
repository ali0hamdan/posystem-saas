import { Type } from 'class-transformer';
import {
  ArrayUnique, IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min, MinLength,
} from 'class-validator';

export class ListMenuItemsQueryDto {
  @IsOptional() @IsString() @MaxLength(200) q?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() includeInactive?: boolean;
}

export class CreateMenuItemDto {
  @IsString() @IsNotEmpty() @MinLength(1) @MaxLength(160) name!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) price!: number;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsString() @MaxLength(40) prepStation?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isAvailable?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(99999) sortOrder?: number;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) modifierGroupIds?: string[];
}

export class UpdateMenuItemDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) name?: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(1_000_000) price?: number;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() categoryId?: string;
  @IsOptional() @IsUUID() productId?: string;
  @IsOptional() @IsString() @MaxLength(40) prepStation?: string;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isAvailable?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(99999) sortOrder?: number;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) modifierGroupIds?: string[];
}
