import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateLicenseClientDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(48)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase letters, digits, and single hyphens',
  })
  slug?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  businessName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  ownerName!: string;

  @IsEmail()
  @MaxLength(200)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
