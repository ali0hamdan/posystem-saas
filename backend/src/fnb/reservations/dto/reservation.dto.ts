import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export const RESERVATION_STATUSES = ['PENDING', 'CONFIRMED', 'SEATED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;
export type ReservationStatusValue = (typeof RESERVATION_STATUSES)[number];

export class ListReservationsQueryDto {
  @IsOptional() @IsDateString() date?: string;
  @IsOptional() @IsIn(RESERVATION_STATUSES) status?: ReservationStatusValue;
}

export class CreateReservationDto {
  @IsString() @IsNotEmpty() @MinLength(1) @MaxLength(120) customerName!: string;
  @IsOptional() @IsString() @MaxLength(40) customerPhone?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) partySize!: number;
  @IsDateString() reservedAt!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) @Max(1440) durationMin?: number;
  @IsOptional() @IsUUID() tableId?: string;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class UpdateReservationDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(120) customerName?: string;
  @IsOptional() @IsString() @MaxLength(40) customerPhone?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) partySize?: number;
  @IsOptional() @IsDateString() reservedAt?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) @Max(1440) durationMin?: number;
  @IsOptional() @IsUUID() tableId?: string | null;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
}

export class SetReservationStatusDto {
  @IsIn(RESERVATION_STATUSES) status!: ReservationStatusValue;
}
