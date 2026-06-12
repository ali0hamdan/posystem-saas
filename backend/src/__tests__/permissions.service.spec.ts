import { BusinessType, UserRole } from '@prisma/client';
import { PermissionsService } from '../permissions/permissions.service';

describe('PermissionsService', () => {
  const service = new PermissionsService();

  it('OWNER has all permissions via wildcard', () => {
    expect(service.hasPermission(UserRole.OWNER, 'billing:update')).toBe(true);
    expect(service.getPermissionsForRole(UserRole.OWNER).length).toBeGreaterThan(50);
  });

  it('maps legacy ADMIN to GENERAL_MANAGER permissions', () => {
    expect(service.hasPermission(UserRole.ADMIN, 'users:create')).toBe(true);
    expect(service.hasPermission(UserRole.ADMIN, 'billing:update')).toBe(false);
  });

  it('maps legacy MANAGER to CO_MANAGER permissions', () => {
    expect(service.hasPermission(UserRole.MANAGER, 'products:view')).toBe(true);
    expect(service.hasPermission(UserRole.MANAGER, 'users:create')).toBe(false);
  });

  it('CASHIER can access POS but not settings', () => {
    expect(service.hasPermission(UserRole.CASHIER, 'pos:access')).toBe(true);
    expect(service.hasPermission(UserRole.CASHIER, 'settings:view')).toBe(false);
    expect(service.hasPermission(UserRole.CASHIER, 'users:view')).toBe(false);
    expect(service.hasPermission(UserRole.CASHIER, 'refunds:print')).toBe(false);
  });

  it('SALESMAN can create sales and customers but not adjust stock', () => {
    expect(service.hasPermission(UserRole.SALESMAN, 'sales:create')).toBe(true);
    expect(service.hasPermission(UserRole.SALESMAN, 'customers:create')).toBe(true);
    expect(service.hasPermission(UserRole.SALESMAN, 'stock:adjust')).toBe(false);
    expect(service.hasPermission(UserRole.SALESMAN, 'bulk_pricing:view')).toBe(false);
  });

  it('STOCK_MANAGER can manage inventory but not process payments', () => {
    expect(service.hasPermission(UserRole.STOCK_MANAGER, 'stock:adjust')).toBe(true);
    expect(service.hasPermission(UserRole.STOCK_MANAGER, 'purchase_orders:receive')).toBe(true);
    expect(service.hasPermission(UserRole.STOCK_MANAGER, 'pos:access')).toBe(false);
    expect(service.hasPermission(UserRole.STOCK_MANAGER, 'sales:create')).toBe(false);
  });

  it('WAITER can manage F&B orders but not menu or users', () => {
    expect(service.hasPermission(UserRole.WAITER, 'fnb_orders:create')).toBe(true);
    expect(service.hasPermission(UserRole.WAITER, 'tables:view')).toBe(true);
    expect(service.hasPermission(UserRole.WAITER, 'menu:create')).toBe(false);
    expect(service.hasPermission(UserRole.WAITER, 'users:view')).toBe(false);
  });

  it('enforces role availability by business type', () => {
    expect(service.isRoleAllowedForBusinessType(UserRole.WAITER, BusinessType.FOOD_BEVERAGE)).toBe(true);
    expect(service.isRoleAllowedForBusinessType(UserRole.WAITER, BusinessType.RETAIL)).toBe(false);
    expect(service.isRoleAllowedForBusinessType(UserRole.SALESMAN, BusinessType.WHOLESALE)).toBe(true);
    expect(service.isRoleAllowedForBusinessType(UserRole.STOCK_MANAGER, BusinessType.FOOD_BEVERAGE)).toBe(false);
    expect(service.isRoleAllowedForBusinessType(UserRole.CASHIER, BusinessType.HYBRID)).toBe(true);
  });

  it('HYBRID includes all operational roles', () => {
    const roles = service.getAllowedRoles(BusinessType.HYBRID);
    expect(roles).toEqual(
      expect.arrayContaining([
        UserRole.OWNER,
        UserRole.GENERAL_MANAGER,
        UserRole.CO_MANAGER,
        UserRole.CASHIER,
        UserRole.SALESMAN,
        UserRole.STOCK_MANAGER,
        UserRole.WAITER,
      ]),
    );
  });
});

import { matchRoutePermission } from '../permissions/route-permissions';
import { PERMISSIONS } from '../permissions/permission.types';

describe('matchRoutePermission', () => {
  it('requires refunds:print for refund print-data endpoint', () => {
    expect(matchRoutePermission('GET', '/refunds/abc-123/print-data')).toBe(
      PERMISSIONS.REFUNDS_PRINT,
    );
  });
});
