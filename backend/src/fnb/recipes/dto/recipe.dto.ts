import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class RecipeIngredientInputDto {
  @IsUUID() productId!: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 3 }) @Min(0.001) @Max(1_000_000) quantity!: number;
  @IsOptional() @IsString() @MaxLength(20) unit?: string;
}

export class UpsertRecipeDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10000) yieldQty?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsArray() @ValidateNested({ each: true }) @Type(() => RecipeIngredientInputDto) ingredients!: RecipeIngredientInputDto[];
}
