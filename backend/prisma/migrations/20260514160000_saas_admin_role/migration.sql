-- SaaS admin RBAC: role column on platform operators.
-- TODO(migration-review): existing rows default to SUPER_ADMIN; adjust in SQL if you need different roles.
CREATE TYPE "SaasAdminRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT', 'BILLING');

ALTER TABLE "SaaSAdmin" ADD COLUMN "role" "SaasAdminRole" NOT NULL DEFAULT 'SUPER_ADMIN';
