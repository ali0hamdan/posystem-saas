import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

export class ListDiningAreasQueryDto {
  @IsOptional() @Type(() => Boolean) @IsBoolean()
  includeInactive?: boolean;
}

export class CreateDiningAreaDto {
  @IsString() @IsNotEmpty() @MinLength(1) @MaxLength(120)
  name!: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;

  @IsOptional() @Type(() => Boolean) @IsBoolean()
  isActive?: boolean;
}

export class UpdateDiningAreaDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120)
  name?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(9999)
  sortOrder?: number;

  @IsOptional() @Type(() => Boolean) @IsBoolean()
  isActive?: boolean;
}
