import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class OpenShiftDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingCash!: number;
}

export class CloseShiftDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  closingCash!: number;
}
