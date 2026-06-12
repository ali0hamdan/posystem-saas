import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export const KITCHEN_STATUSES = ['QUEUED', 'PREPARING', 'READY', 'BUMPED', 'RECALLED'] as const;
export type KitchenStatusValue = (typeof KITCHEN_STATUSES)[number];

export class ListKitchenQueryDto {
  @IsOptional() @IsIn(['ACTIVE', ...KITCHEN_STATUSES]) status?: string;
  @IsOptional() @IsString() @MaxLength(40) station?: string;
}

export class SetKitchenStatusDto {
  @IsIn(KITCHEN_STATUSES) status!: KitchenStatusValue;
}
