import { Injectable } from '@nestjs/common';
import { BusinessType, UserRole } from '@prisma/client';
import { ALL_PERMISSIONS, Permission } from './permission.types';
import {
  ROLE_ALIASES,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSION_GRANTS,
  ROLES_BY_BUSINESS_TYPE,
} from './role-permissions';

@Injectable()
export class PermissionsService {
  resolveRole(role: UserRole): UserRole {
    return ROLE_ALIASES[role] ?? role;
  }

  hasPermission(role: UserRole, permission: Permission): boolean {
    const grants = this.getGrantsForRole(role);
    if (grants.includes('*')) return true;
    for (const grant of grants) {
      if (grant === permission) return true;
      if (grant.endsWith(':*')) {
        const prefix = grant.slice(0, -1);
        if (permission.startsWith(prefix)) return true;
      }
    }
    return false;
  }

  hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
    return permissions.some((p) => this.hasPermission(role, p));
  }

  getPermissionsForRole(role: UserRole): Permission[] {
    const grants = this.getGrantsForRole(role);
    if (grants.includes('*')) return [...ALL_PERMISSIONS];
    const set = new Set<Permission>();
    for (const grant of grants) {
      if (grant.endsWith(':*')) {
        const prefix = grant.slice(0, -1);
        for (const p of ALL_PERMISSIONS) {
          if (p.startsWith(prefix)) set.add(p);
        }
      } else {
        set.add(grant);
      }
    }
    return [...set].sort();
  }

  getGrantsForRole(role: UserRole): Permission[] {
    const effective = this.resolveRole(role);
    const direct = ROLE_PERMISSION_GRANTS[effective] ?? [];
    if (direct.length) return direct;
    return ROLE_PERMISSION_GRANTS[role] ?? [];
  }

  getAllowedRoles(businessType: BusinessType): UserRole[] {
    return ROLES_BY_BUSINESS_TYPE[businessType] ?? ROLES_BY_BUSINESS_TYPE.RETAIL;
  }

  isRoleAllowedForBusinessType(role: UserRole, businessType: BusinessType): boolean {
    return this.getAllowedRoles(businessType).includes(role);
  }

  getRoleMeta(businessType: BusinessType) {
    return this.getAllowedRoles(businessType).map((role) => ({
      role,
      description: ROLE_DESCRIPTIONS[role],
      permissions: this.getPermissionsForRole(role),
    }));
  }
}
