import { IsOptional, IsString, MaxLength } from 'class-validator';

export class LookupSalesmanQueryDto {
  @IsString()
  @MaxLength(64)
  code!: string;
}

export class SearchSalesmenQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
