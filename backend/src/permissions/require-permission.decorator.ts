import { SetMetadata } from '@nestjs/common';
import { Permission } from './permission.types';
import { PERMISSIONS_ANY_KEY, PERMISSIONS_KEY } from './permissions.constants';

export const RequirePermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

export const RequireAnyPermission = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_ANY_KEY, permissions);
