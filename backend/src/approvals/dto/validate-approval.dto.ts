import { IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { RefundApprovalMethod } from '@prisma/client';

export class ValidateApprovalDto {
  @IsOptional()
  @IsEnum(RefundApprovalMethod)
  method?: RefundApprovalMethod;

  @ValidateIf((o: ValidateApprovalDto) => !o.method || o.method === RefundApprovalMethod.APPROVAL_ID)
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(64)
  approvalIdCode?: string;

  @ValidateIf(
    (o: ValidateApprovalDto) =>
      o.method === RefundApprovalMethod.NFC_CARD ||
      o.method === RefundApprovalMethod.NFC_CARD_AND_PIN,
  )
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  nfcCardUid?: string;

  @ValidateIf((o: ValidateApprovalDto) => o.method === RefundApprovalMethod.NFC_CARD_AND_PIN)
  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  approvalPin?: string;
}
