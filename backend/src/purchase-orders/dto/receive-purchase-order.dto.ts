import { Type } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

export class ReceivePurchaseOrderDto {
  /**
   * When true (default), each product's `costPrice` is set to the line's purchase `costPrice` on receive.
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  updateProductCostPrices?: boolean;
}
