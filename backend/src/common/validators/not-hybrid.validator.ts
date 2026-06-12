import { registerDecorator, type ValidationOptions } from 'class-validator';
import { BusinessType } from '@prisma/client';

/**
 * Property-level validator that rejects `BusinessType.HYBRID`.
 *
 * Hybrid was discontinued and is no longer offered to new customers. The
 * `BusinessType` enum value is intentionally kept in the Prisma schema to
 * preserve any legacy HYBRID tenants — but every new-entry path (public
 * registration, SaaS admin create/edit client) must refuse it.
 */
export function NotHybrid(options?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'NotHybrid',
      target: object.constructor,
      propertyName,
      options: {
        message: 'Hybrid is no longer offered. Pick RETAIL, FOOD_BEVERAGE, or WHOLESALE.',
        ...options,
      },
      validator: {
        validate(value: unknown): boolean {
          if (value === undefined || value === null) return true;
          return value !== BusinessType.HYBRID;
        },
      },
    });
  };
}
