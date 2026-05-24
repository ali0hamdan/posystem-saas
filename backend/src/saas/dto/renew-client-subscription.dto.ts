import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class RenewClientSubscriptionDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3650)
  extendDays!: number;
}
