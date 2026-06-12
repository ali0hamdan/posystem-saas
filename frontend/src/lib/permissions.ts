import type { UserRole } from '@/types/auth';

/** Legacy role equivalents for sidebar/route fallbacks. */
const ROLE_EQUIVALENTS: Partial<Record<UserRole, UserRole>> = {
  GENERAL_MANAGER: 'ADMIN',
  CO_MANAGER: 'MANAGER',
  ADMIN: 'GENERAL_MANAGER',
  MANAGER: 'CO_MANAGER',
};

export function roleMatches(role: UserRole | undefined, allow: UserRole[]): boolean {
  if (!role) return false;
  if (allow.includes(role)) return true;
  const mapped = ROLE_EQUIVALENTS[role];
  return mapped ? allow.includes(mapped) : false;
}

export function hasPermission(
  permissions: readonly string[] | undefined,
  permission: string,
): boolean {
  if (!permissions?.length) return false;
  if (permissions.includes('*')) return true;
  if (permissions.includes(permission)) return true;
  const [resource] = permission.split(':');
  if (resource && permissions.includes(`${resource}:*`)) return true;
  return false;
}

export function hasAnyPermission(
  permissions: readonly string[] | undefined,
  required: string | string[],
): boolean {
  const list = Array.isArray(required) ? required : [required];
  return list.some((p) => hasPermission(permissions, p));
}

export function hasAllPermissions(
  permissions: readonly string[] | undefined,
  required: string[],
): boolean {
  return required.every((p) => hasPermission(permissions, p));
}
