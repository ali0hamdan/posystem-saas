import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';

export class LoginDto {
  /** Tenant slug — required when the same email exists on multiple stores. */
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'clientSlug must be lowercase letters, digits, and single hyphens',
  })
  clientSlug?: string;

  /** Primary login identity for new registrations (owner email). */
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  /** Backward-compatible alias: email or legacy username. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier?: string;

  /** Legacy username login for existing users. */
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  username?: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(256)
  password!: string;
}
