import { Global, Module } from '@nestjs/common';
import { FeatureService } from './feature.service';
import { FeatureGuard } from './feature.guard';

/**
 * Global module exposing F&B feature gating (`FeatureService` + `FeatureGuard`).
 * Imported once in `AppModule`; the service/guard are then injectable anywhere.
 */
@Global()
@Module({
  providers: [FeatureService, FeatureGuard],
  exports: [FeatureService, FeatureGuard],
})
export class FeatureModule {}
