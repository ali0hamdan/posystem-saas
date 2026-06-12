import { IsEmail, MaxLength } from 'class-validator';

export class ResendEmailOtpDto {
  @IsEmail()
  @MaxLength(200)
  email!: string;
}
