import { Type } from 'class-transformer';
import {
  ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min,
} from 'class-validator';

export const ORDER_TYPES = ['DINE_IN', 'TAKEAWAY', 'DELIVERY'] as const;
export type OrderTypeValue = (typeof ORDER_TYPES)[number];
export const PAYMENT_METHODS = ['CASH', 'CARD', 'CREDIT', 'OTHER'] as const;

export class OpenOrderDto {
  @IsIn(ORDER_TYPES) type!: OrderTypeValue;
  @IsOptional() @IsUUID() tableId?: string;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) guestCount?: number;
  @IsOptional() @IsString() @MaxLength(500) notes?: string;
  @IsOptional() @IsString() @MaxLength(300) deliveryAddress?: string;
  @IsOptional() @IsString() @MaxLength(40) deliveryPhone?: string;
}

export class UpdateDeliveryDto {
  @IsOptional() @IsString() @MaxLength(80) driverName?: string;
  @IsOptional() @IsString() @MaxLength(300) deliveryAddress?: string;
  @IsOptional() @IsString() @MaxLength(40) deliveryPhone?: string;
}

export class AddOrderItemDto {
  @IsUUID() menuItemId!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(999) quantity?: number;
  @IsOptional() @IsString() @MaxLength(300) notes?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsUUID('all', { each: true }) modifierIds?: string[];
}

export class UpdateOrderItemDto {
  @Type(() => Number) @IsInt() @Min(1) @Max(999) quantity!: number;
}

export class SettleOrderDto {
  @IsOptional() @IsIn(PAYMENT_METHODS) paymentMethod?: (typeof PAYMENT_METHODS)[number];
  @IsOptional() @Type(() => Number) @Min(0) @Max(1_000_000) discount?: number;
}

export class ListOrdersQueryDto {
  @IsOptional() @IsIn(['OPEN', 'SENT', 'READY', 'SERVED', 'COMPLETED', 'CANCELLED']) status?: string;
  @IsOptional() @IsUUID() tableId?: string;
}
