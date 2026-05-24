import { Type } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class PatchClientUserStatusDto {
  @Type(() => Boolean)
  @IsBoolean()
  isActive!: boolean;
}
