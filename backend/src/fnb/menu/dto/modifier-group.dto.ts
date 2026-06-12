import { Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, IsUUID,
  Max, MaxLength, Min, MinLength, ValidateNested,
} from 'class-validator';

export class ModifierInputDto {
  @IsOptional() @IsUUID() id?: string;
  @IsString() @IsNotEmpty() @MinLength(1) @MaxLength(80) name!: string;
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(-100000) @Max(1_000_000) priceDelta?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999) sortOrder?: number;
}

export class ListModifierGroupsQueryDto {
  @IsOptional() @Type(() => Boolean) @IsBoolean() includeInactive?: boolean;
}

export class CreateModifierGroupDto {
  @IsString() @IsNotEmpty() @MinLength(1) @MaxLength(120) name!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(50) minSelect?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) maxSelect?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() required?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999) sortOrder?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ModifierInputDto) modifiers?: ModifierInputDto[];
}

export class UpdateModifierGroupDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) name?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(50) minSelect?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) maxSelect?: number;
  @IsOptional() @Type(() => Boolean) @IsBoolean() required?: boolean;
  @IsOptional() @Type(() => Boolean) @IsBoolean() isActive?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999) sortOrder?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => ModifierInputDto) modifiers?: ModifierInputDto[];
}
