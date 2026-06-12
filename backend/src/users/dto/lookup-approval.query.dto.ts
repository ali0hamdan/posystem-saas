import { IsString, MaxLength } from 'class-validator';

export class LookupApprovalQueryDto {
  @IsString()
  @MaxLength(64)
  code!: string;
}
