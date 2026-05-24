import { UserRole } from '@prisma/client';
import { Allow, IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength, ValidateIf } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  /** Omit to leave unchanged; `null` or empty string clears email. */
  @IsOptional()
  @Allow()
  @ValidateIf((_, v) => v !== undefined && v !== null && String(v).trim() !== '')
  @IsEmail()
  @MaxLength(254)
  email?: string | null;
}
