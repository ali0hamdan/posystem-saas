import { IsBoolean, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterNfcCardDto {
  @IsString()
  @MinLength(4)
  @MaxLength(64)
  nfcCardUid!: string;
}

export class SetNfcEnabledDto {
  @IsBoolean()
  nfcEnabled!: boolean;
}

export class SetApprovalPinDto {
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4–6 digits' })
  pin!: string;
}
