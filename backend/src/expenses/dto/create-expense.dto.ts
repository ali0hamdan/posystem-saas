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
} from 'class-validator';

export class CreateExpenseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;

  /** OWNER/ADMIN: who incurred the expense when not tied to a shift. Ignored when `shiftId` is set (uses shift cashier). */
  @IsOptional()
  @IsUUID()
  createdById?: string;

  /** Optional for OWNER/ADMIN (non-drawer). Required for CASHIER (must be their current open shift). */
  @IsOptional()
  @IsUUID()
  shiftId?: string;
}
