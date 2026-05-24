import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  /** Set to a shift id to attach drawer spend, or `null` to clear. OWNER/ADMIN only. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  shiftId?: string | null;
}
