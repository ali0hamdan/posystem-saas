import { IsEmail, IsString, Length, MaxLength } from 'class-validator';

export class VerifyEmailOtpDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsString()
  @Length(6, 6)
  otp!: string;
}
