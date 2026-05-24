import { Module } from '@nestjs/common';
import { LicenseTokenService } from './license-token.service';
import { LicenseValidationService } from './license-validation.service';
import { LicenseService } from './license.service';
import { LicenseAdminService } from './license-admin.service';
import { LicenseController } from './license.controller';
import { LicenseGuard } from './license.guard';

@Module({
  controllers: [LicenseController],
  providers: [
    LicenseTokenService,
    LicenseValidationService,
    LicenseService,
    LicenseAdminService,
    LicenseGuard,
  ],
  exports: [
    LicenseService,
    LicenseTokenService,
    LicenseValidationService,
    LicenseGuard,
    LicenseAdminService,
  ],
})
export class LicenseModule {}
