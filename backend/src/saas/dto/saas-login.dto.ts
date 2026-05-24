import { IsEmail, IsOptional, IsString, Length, MinLength } from 'class-validator';

export class SaasLoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(1, { message: 'password is required' })
  password!: string;

  /** TOTP code from authenticator app — required if 2FA is enabled. */
  @IsOptional()
  @IsString()
  @Length(6, 6)
  totpCode?: string;
}
