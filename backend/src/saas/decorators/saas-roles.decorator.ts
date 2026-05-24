import { SetMetadata } from '@nestjs/common';
import { SaasAdminRole } from '@prisma/client';
import { SAAS_ROLES_KEY } from '../saas.constants';

/** When omitted, {@link SaasRoleGuard} allows any authenticated SaaS admin. */
export const SaasRoles = (...roles: SaasAdminRole[]) => SetMetadata(SAAS_ROLES_KEY, roles);
