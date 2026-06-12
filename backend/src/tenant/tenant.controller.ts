import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SafeUser } from '../auth/types/safe-user.type';
import { FeatureService } from '../fnb/feature/feature.service';

/**
 * Per-tenant runtime context for the authenticated store user. Drives which POS
 * surfaces (retail / F&B) the frontend exposes, gated by business type + plan
 * feature flags. Read-only; the real security boundary is server-side gating.
 */
@Controller('tenant')
@UseGuards(JwtAuthGuard)
export class TenantController {
  constructor(private readonly features: FeatureService) {}

  @Get('context')
  async context(@CurrentUser() user: SafeUser) {
    const [businessType, enabledFeatures] = await Promise.all([
      this.features.getBusinessType(user.clientId),
      this.features.getEnabledFeatures(user.clientId),
    ]);
    return { businessType, enabledFeatures };
  }
}
