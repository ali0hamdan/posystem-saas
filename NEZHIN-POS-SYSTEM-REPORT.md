# Nezhin POS — Complete System Technical Report

**Document version:** 2026-06-12  
**Codebase:** `stock-managment` (NestJS backend + React/Vite frontend)  
**Author:** Generated from source inspection (no assumptions)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Technical Architecture](#2-technical-architecture)
3. [Business Modules Overview](#3-business-modules-overview)
4. [SaaS Onboarding & Subscription](#4-saas-onboarding--subscription)
5. [Roles & Permissions](#5-roles--permissions)
6. [Core POS Features](#6-core-pos-features)
7. [Retail Module](#7-retail-module)
8. [Food & Beverage Module](#8-food--beverage-module)
9. [Wholesale / B2B Module](#9-wholesale--b2b-module)
10. [Notifications & Email](#10-notifications--email)
11. [OTP & Security](#11-otp--security)
12. [Refunds, Approvals, NFC, Commission](#12-refunds-approvals-nfc-commission)
13. [Reports & Printing](#13-reports--printing)
14. [API Endpoints](#14-api-endpoints)
15. [Database Models & Enums](#15-database-models--enums)
16. [Frontend Pages & Components](#16-frontend-pages--components)
17. [Testing & Build Status](#17-testing--build-status)
18. [Missing Features / TODOs](#18-missing-features--todos)
19. [Recommended Implementation Roadmap](#19-recommended-implementation-roadmap)

---

## 1. Executive Summary

### What Nezhin POS Is

**Nezhin POS** is a multi-tenant SaaS point-of-sale platform. One SaaS product serves multiple business workflows depending on the tenant's **business type** (`RETAIL`, `FOOD_BEVERAGE`, `WHOLESALE`, `HYBRID`) and **subscription package** (Starter, Business, Pro, Enterprise, Lifetime Desktop).

### Current Readiness: **Beta / Internal Testing**

| Area | Status |
|------|--------|
| Core retail POS (sales, stock, products, customers) | **Implemented** |
| Multi-tenant isolation | **Implemented** (with review items) |
| SaaS registration + OTP + simulated payment | **Implemented** |
| Real payment gateway | **Missing** (simulate-only) |
| F&B module (tables, orders, kitchen, recipes, waste, delivery, reservations) | **Implemented** |
| Wholesale B2B (quotations, proforma, official invoices, delivery notes, credit) | **Implemented** |
| Unified refunds (retail, F&B, wholesale) + manager approval ID + NFC | **Implemented** |
| Salesman ID + commission system | **Implemented** |
| Notification preferences + email dispatch + subscription expiry cron | **Implemented** |
| Permission system (backend + partial frontend) | **Partially implemented** |
| Offline sync (Dexie queue) | **Partially implemented** |
| Automated tests | **133 passing** (16 suites) |
| Production hardening (webhooks, monitoring, full audit) | **Missing / partial** |

### What Is Complete

- End-to-end tenant registration: register → email OTP → verify → payment page → simulate success → client activation → login → dashboard redirect by business type.
- Retail checkout, stock movements, purchase orders, refunds, reports.
- F&B dine-in/takeaway/delivery orders, kitchen tickets, recipe stock deduction, waste, reservations.
- Wholesale document workflow: quotation → proforma → official invoice (`Sale`), stock reservations, delivery notes, customer credit/ledger, bulk pricing/price lists.
- Role-based permissions with legacy alias support (`ADMIN` → `GENERAL_MANAGER`, `MANAGER` → `CO_MANAGER`).
- Manager approval ID (`NAME@12345`) and optional NFC card/PIN refund approval.
- Salesman ID (`NAME-1234`) with commission accrual on retail sales and wholesale official invoices.

### What Is Partially Complete

- Frontend route protection uses `RoleRoute` heavily; `PermissionRoute` + `ROUTE_PERMISSIONS` map exists but is **not wired into the router**.
- Wholesale shared routes (`/wholesale/products`, etc.) are **missing from** `frontend/src/config/route-permissions.ts`.
- Plan limits enforced for users/branches; **device limit check exists but is not wired** to activation.
- `CUSTOMER_OVERDUE` notification type exists in schema but **no cron trigger** found.
- Refund receipt printing: refunds list/history exists; **dedicated refund print route/page not found**.
- SaaS settings page is a **placeholder**.

### What Should Be Implemented Next

See [Section 19 — Recommended Implementation Roadmap](#19-recommended-implementation-roadmap).

---

## 2. Technical Architecture

### 2.1 System Name & Purpose

| Item | Value |
|------|-------|
| **System name** | Nezhin POS |
| **Purpose** | Cloud SaaS POS for retail, F&B, wholesale/B2B, and hybrid businesses |
| **Target businesses** | Shops, restaurants/cafés, wholesalers/distributors, multi-vertical operators |
| **SaaS model** | Subscription plans with user/branch/device limits; optional lifetime desktop tier |

### 2.2 Main Technologies

| Layer | Stack |
|-------|-------|
| Backend | NestJS 10+, TypeScript, Prisma ORM, PostgreSQL |
| Frontend | React 18, Vite, TypeScript, React Router, Tailwind CSS |
| Auth | JWT (access + refresh), bcrypt passwords, separate SaaS admin JWT |
| Email | Nodemailer SMTP (`backend/src/email/`) |
| Scheduling | `@nestjs/schedule` — hourly subscription expiry cron |
| Logging | Pino (`nestjs-pino`), redacts auth headers |
| Rate limiting | `@nestjs/throttler` global + per-route overrides |
| Offline (client) | Dexie IndexedDB queue (`frontend/src/offline/`) |

### 2.3 Backend Structure

**Entry:** `backend/src/main.ts` → `AppModule` (`backend/src/app.module.ts`)

**Global pipeline (order matters):**

1. `ThrottlerGuard` — rate limits
2. `LicenseGuard` — legacy/desktop license token (optional header)
3. `AllExceptionsFilter` — unified error responses
4. `SubscriptionEnforcementInterceptor` — blocks SUSPENDED/EXPIRED/CANCELLED subscriptions except whitelisted paths
5. Per-route: `JwtAuthGuard` → `RolesGuard` / `PermissionsGuard` → `@RequireFeature` (F&B)

**NestJS modules (46+ domain modules):**

| Module | Path | Purpose |
|--------|------|---------|
| Auth | `backend/src/auth/` | Login, refresh, forgot/reset password, `/auth/me` |
| Public | `backend/src/public/` | Registration, OTP verify, payment simulate |
| SaaS | `backend/src/saas/` | Super admin auth, clients, plans, subscriptions, audit |
| Users | `backend/src/users/` | CRUD, salesman ID, approval ID, NFC cards |
| Permissions | `backend/src/permissions/` | Role grants, route permission matching |
| Products/Categories/Stock | `products/`, `categories/`, `stock/` | Catalog & inventory |
| Sales/Refunds/Commissions | `sales/`, `refunds/`, `commissions/` | Transactions |
| Customers/Suppliers/PO | `customers/`, `suppliers/`, `purchase-orders/` | CRM & procurement |
| Branches/Transfers/Shifts | `branches/`, `stock-transfers/`, `shifts/` | Multi-branch ops |
| Reports | `reports/` | Retail analytics |
| Settings | `settings/` | Store settings |
| Notifications/Email/OTP | `notifications/`, `email/`, `otp/` | Alerts & verification |
| F&B | `backend/src/fnb/*` | Tables, menu, orders, kitchen, recipes, waste, delivery, reservations, reports |
| Wholesale | `backend/src/wholesale/*` | B2B docs, credit, reservations, print, approvals |
| Quotations/Proforma | `quotations/`, `proforma-invoices/` | Pre-invoice documents |
| Approvals | `backend/src/approvals/` | Refund approval validation (ID/NFC) |
| License/Activation | `license/`, `activation/` | Desktop device licensing |
| Tenant | `tenant/` | Tenant context for client apps |
| Common | `common/` | Plan limits, document numbering, subscription interceptor |
| Audit | `audit/` | Audit log writes |

**Database access pattern:** Services inject `PrismaService`; virtually all queries filter by `user.clientId` or resolved `branchId` via `BranchScopeService`.

### 2.4 Frontend Structure

| Area | Path |
|------|------|
| Router | `frontend/src/app/router.tsx` |
| Business-type guards | `frontend/src/app/router-guards.tsx` (`RetailExclusive`, `FnbOnly`, `WholesaleOnly`) |
| Wholesale shared routes | `frontend/src/app/wholesale-shared-routes.tsx` |
| SaaS admin routes | `frontend/src/saas/saas-routes.tsx` |
| Auth | `frontend/src/context/AuthContext.tsx`, `ProtectedRoute`, `SessionGate` |
| API clients | `frontend/src/api/*.api.ts` (55 files) |
| Theme | `frontend/src/components/theme/ThemeToggle.tsx`, Tailwind `dark:` classes |
| Permissions config | `frontend/src/config/route-permissions.ts` |

### 2.5 Database Structure

- **ORM:** Prisma (`backend/prisma/schema.prisma`)
- **Models:** 65 models
- **Enums:** 48 enums
- **Migrations:** 34+ migration folders under `backend/prisma/migrations/`
- **Seed:** `backend/prisma/seed.ts`

**Tenant root:** `Client` (mapped to legacy `LicenseClient` table)

### 2.6 Authentication Model

| Actor | Mechanism | Separation |
|-------|-----------|------------|
| Store users | JWT (`JwtAuthGuard`), payload includes `clientId`, `role`, `subscriptionStatus` | Cannot access `/saas/*` |
| SaaS admins | Separate SaaS JWT (`SaasAuthModule`) | Cannot use store JWT on SaaS routes |
| Public | No auth on `/public/*`, throttled | Registration & payment status only |

**Password hashing:** bcrypt, 12 rounds (`BCRYPT_ROUNDS` in `public.service.ts`, `auth.service.ts`)

**Dashboard redirect:** `backend/src/common/dashboard-path.util.ts`

| BusinessType | Path |
|--------------|------|
| RETAIL | `/dashboard` |
| HYBRID | `/dashboard` (grouped nav in layout) |
| FOOD_BEVERAGE | `/fnb/dashboard` |
| WHOLESALE | `/wholesale/dashboard` |

Returned in login response and `GET /auth/me` as `nextDashboardUrl`.

### 2.7 Subscription / Package Model

**Plan** (`Plan` model): codes `STARTER`, `BUSINESS`, `PRO`, `ENTERPRISE`, `LIFETIME_DESKTOP`; limits `maxUsers`, `maxBranches`, `maxDevices`; pricing per billing cycle.

**Subscription** (`Subscription` model, legacy table `License`): per-client active subscription with status enum, expiry, grace period, copied limits.

**Enforcement:**

- `PlanLimitService` — user/branch creation limits (**device limit method exists, not wired**)
- `SubscriptionEnforcementInterceptor` — blocks API for expired/suspended/cancelled tenants

---

## 3. Business Modules Overview

Nezhin POS is **one platform** with shared core (products, stock, users, branches, customers) and **business-type-specific** modules:

```
                    ┌─────────────────────────────────┐
                    │         Nezhin POS SaaS         │
                    │   Client (tenant) + Subscription │
                    └───────────────┬─────────────────┘
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         │                          │                          │
    ┌────▼────┐              ┌──────▼──────┐            ┌──────▼──────┐
    │ RETAIL  │              │ FOOD_BEV    │            │ WHOLESALE   │
    │ POS     │              │ Tables/Menu │            │ B2B Docs    │
    │ Coupons │              │ Kitchen     │            │ Credit      │
    └────┬────┘              └──────┬──────┘            └──────┬──────┘
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    │
                              ┌─────▼─────┐
                              │  HYBRID   │
                              │ All modules│
                              └───────────┘
```

Shared across types: Users, Branches, Products, Stock, Customers, Suppliers, Purchase Orders, Settings, Notifications, Refunds (unified), Commissions.

---

## 4. SaaS Onboarding & Subscription

### 4.1 Public Flow

**Frontend pages:**

| Route | Page | Purpose |
|-------|------|---------|
| `/` | `LandingPage` | Marketing |
| `/pricing` | `PricingPage` | Plan comparison |
| `/get-started` | `GetStartedPage` | Business type + plan selection wizard |
| `/register` | `RegisterPage` | Owner details form |
| `/verify-email` | `VerifyEmailPage` | OTP entry |
| `/payment` | `PaymentPage` | Checkout (dev: links to simulate) |
| `/payment-success` | `PaymentSuccessPage` | Post-payment confirmation |
| `/payment-cancelled` | `PaymentCancelledPage` | Cancelled checkout |

**Backend:** `PublicController` (`backend/src/public/public.controller.ts`)

| Method | URL | Purpose |
|--------|-----|---------|
| GET | `/public/plans` | List active plans |
| POST | `/public/register` | Create client (PENDING_EMAIL_VERIFICATION) |
| POST | `/public/verify-email-otp` | Verify OTP → PENDING_PAYMENT |
| POST | `/public/resend-email-otp` | Resend OTP (cooldown) |
| GET | `/public/payments/:id` | Payment status poll |
| POST | `/public/payments/:id/simulate-success` | **Dev only** — activate subscription |

### 4.2 Registration Steps (actual code)

1. **Register** — Creates `Client`, owner `User`, default `Branch`, `StoreSettings`, `Subscription` (PENDING_PAYMENT), `PaymentRecord` (PENDING), sends email OTP.
2. **Verify email OTP** — Sets user `emailVerified`, client → `PENDING_PAYMENT`.
3. **Payment** — Frontend shows payment page; production gateway **not implemented**.
4. **Simulate success** — Marks payment PAID, activates subscription (ACTIVE/TRIALING), client → ACTIVE, sends WELCOME_MESSAGE + SUBSCRIPTION_RENEWED_INVOICE notifications.
5. **Login** — Owner logs in → redirected per business type.

### 4.3 Client Status States

`ClientStatus`: `ACTIVE`, `SUSPENDED`, `INACTIVE`, `PENDING_EMAIL_VERIFICATION`, `PENDING_PAYMENT`

### 4.4 Subscription States

`SubscriptionStatus`: `PENDING_PAYMENT`, `TRIALING`, `ACTIVE`, `PAST_DUE`, `EXPIRED`, `SUSPENDED`, `CANCELLED`, `LIFETIME`

**Blocked API access:** SUSPENDED, EXPIRED, CANCELLED (except `/auth`, `/billing`, `/tenant`, etc.)

**PAST_DUE:** Allowed through with UI warning.

### 4.5 Subscription Expiry Notifications

**Cron:** `NotificationCronService` — `@Cron('0 * * * *')` hourly  
**Types:** `SUBSCRIPTION_EXPIRING_48H`, `SUBSCRIPTION_EXPIRING_24H`  
**Dedup:** `SubscriptionNotificationLog` unique on `(subscriptionId, notificationType)`

### 4.6 Payment Status

| Environment | Behavior |
|-------------|----------|
| Development | `POST /public/payments/:id/simulate-success` |
| Production | **Real gateway not implemented**; webhook needed |

### 4.7 SaaS Super Admin

**Routes:** `/saas/*` (see Section 16)

**Backend controllers:** `saas-auth`, `saas-clients`, `saas-plans`, `saas-license-admin`, `saas-activation-codes`, `saas-audit-logs`

Capabilities: list/manage clients, subscriptions, plans, devices, activation codes, audit logs, manual subscription patch.

---

## 5. Roles & Permissions

### 5.1 All Roles (Prisma `UserRole`)

| Role | Status | Notes |
|------|--------|-------|
| OWNER | Active | Full `*` permissions |
| GENERAL_MANAGER | Active | Admin-level ops + approvals |
| CO_MANAGER | Active | Manager-level ops |
| ADMIN | Legacy alias | Maps to GENERAL_MANAGER |
| MANAGER | Legacy alias | Maps to CO_MANAGER |
| CASHIER | Active | POS + limited views |
| SALESMAN | Active | Sales/quotations, own commissions |
| STOCK_MANAGER | Active | Inventory + PO |
| WAITER | Active | F&B tables/orders |
| KITCHEN | Active | Kitchen display only |
| DELIVERY_DRIVER | Active | F&B delivery updates |

**Source:** `backend/src/permissions/role-permissions.ts`

### 5.2 Roles by Business Type

| Business Type | Available Roles |
|---------------|-----------------|
| RETAIL | OWNER, GENERAL_MANAGER, CO_MANAGER, CASHIER, SALESMAN, STOCK_MANAGER, ADMIN*, MANAGER* |
| FOOD_BEVERAGE | OWNER, GENERAL_MANAGER, CO_MANAGER, CASHIER, WAITER, KITCHEN, ADMIN*, MANAGER* |
| WHOLESALE | OWNER, GENERAL_MANAGER, CO_MANAGER, CASHIER, SALESMAN, STOCK_MANAGER, ADMIN*, MANAGER* |
| HYBRID | All of the above |

\*Legacy roles still in enum and dropdown for backward compatibility.

### 5.3 Role Equivalence

```typescript
ROLE_ALIASES = {
  ADMIN → GENERAL_MANAGER,
  MANAGER → CO_MANAGER,
}
```

### 5.4 Permission Highlights by Role

| Role | Can | Cannot |
|------|-----|--------|
| OWNER | Everything including billing, notification settings, refund approval method, NFC mgmt | — |
| GENERAL_MANAGER | Products, stock, sales, refunds (approve), users (create/update), commissions approve/pay, full wholesale/F&B admin | Billing, owner-only settings |
| CO_MANAGER | View/create sales, refunds (create, no approve on backend for some paths), limited wholesale/F&B | User create, commission approve, billing |
| CASHIER | POS, sales create/view/print, shifts, limited wholesale invoice print | Stock admin, user mgmt |
| SALESMAN | POS, customers, sales, quotations/proforma (wholesale), own commissions | Stock, refunds, user mgmt |
| STOCK_MANAGER | Products, stock, PO, suppliers, labels, reservations view | Sales admin, billing |
| WAITER | F&B tables, orders create/update | Menu edit, payments (except via order flow), stock |
| KITCHEN | Kitchen ticket view/update | Everything else |
| DELIVERY_DRIVER | Delivery order view/update | POS, menu, stock |

### 5.5 Backend Guards

| Guard | File | Purpose |
|-------|------|---------|
| JwtAuthGuard | `auth/guards/jwt-auth.guard.ts` | Validates store JWT |
| RolesGuard | `auth/guards/roles.guard.ts` | `@Roles()` decorator |
| PermissionsGuard | `permissions/permissions.guard.ts` | `@Permissions()` + route map |
| FeatureGuard | `fnb/feature/feature.guard.ts` | F&B feature flags per plan |
| LicenseGuard | `license/license.guard.ts` | Desktop license header |

### 5.6 Frontend Protection

- **Primary:** `RoleRoute` with hardcoded role arrays per route in `router.tsx`
- **Secondary (unused in router):** `PermissionRoute` + `ROUTE_PERMISSIONS`
- **Business type:** `RetailExclusive`, `FnbOnly`, `WholesaleOnly`
- **Gap:** Wholesale shared routes not in `ROUTE_PERMISSIONS`; permission-based UI gating incomplete

### 5.7 Permission Gaps

- Some controllers use `@Roles` only, not `@Permissions` — inconsistent enforcement.
- Frontend relies on role names including legacy ADMIN/MANAGER instead of GENERAL_MANAGER/CO_MANAGER in many routes.
- CO_MANAGER lacks `REFUNDS_APPROVE` permission but may initiate refunds (approval validated separately via approval ID/NFC at completion).

---

## 6. Core POS Features

Shared infrastructure used by all business types:

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| Multi-branch | `branches/` | `BranchesPage` | Implemented |
| Branch stock | `BranchStock` model | branch header `x-branch-id` | Implemented |
| Products & categories | `products/`, `categories/` | `ProductsPage`, `CategoriesPage` | Implemented |
| Stock movements/adjust | `stock/stock-movements.controller.ts` | `StockMovementsPage` | Implemented |
| Stock transfers | `stock-transfers/` | `StockTransfersPage` | Implemented |
| Purchase orders | `purchase-orders/` | `PurchasesPage` | Implemented |
| Customers + ledger | `customers/` | `CustomersPage`, `CustomerDetailPage` | Implemented |
| Suppliers | `suppliers/` | `SuppliersPage` | Implemented |
| Users | `users/` | `UsersPage`, `EditUserModal` | Implemented |
| Settings | `settings/` | `SettingsPage` | Implemented |
| Shifts | `shifts/` | integrated in POS | Implemented |
| Expenses | `expenses/` | — | Backend only (no dedicated FE page found) |
| Coupons | `coupons/` | `CouponsPage` (retail only) | Implemented |
| Audit logs | `audit/` | SaaS admin view | Partial |

---

## 7. Retail Module

### 7.1 Dashboard

- **Route:** `/dashboard` (RetailExclusive)
- **Backend:** `GET /reports/dashboard`
- **Roles:** OWNER, ADMIN, MANAGER (frontend RoleRoute)
- **Metrics:** Sales, profit, stock value, low stock, customers (via reports service)

### 7.2 POS Checkout

- **Route:** `/pos`
- **Backend:** `POST /sales`
- **Frontend:** `PosPage` — barcode scan, cart, payment methods (CASH, CARD, MIXED, CREDIT)
- **Roles:** CASHIER, SALESMAN, managers, owner
- **Models:** `Sale`, `SaleItem`, `Payment`, `StockMovement` (type SALE)
- **Salesman ID:** Required for CASHIER when creating sale if salesman assigned (`salesmanId` field on DTO)

### 7.3 Sales History & Receipt

- **Route:** `/sales`, `/sales/:id/print`
- **Backend:** `GET /sales`, `GET /sales/:id`, `GET /sales/invoice/:invoiceNumber`
- **Print:** Uses `B2bPrintPage` for retail receipt print route (shared component)
- **Status:** Implemented

### 7.4 Products, SKU, Barcode, Labels

- **Product model:** `sku`, `barcode` (unique per client), `lowStockAlert`, branch stock via `BranchStock`
- **SKU/barcode generation:** Product service auto-generates numeric barcode if empty
- **Labels:** `/product-labels` — `ProductLabelsPage` (OWNER/ADMIN/MANAGER)
- **Scanner flow:** POS page listens for barcode input → product lookup by barcode

### 7.5 Refunds (Retail)

- **Unified refund API:** `POST /refunds` with `sourceType: RETAIL_SALE`
- **Legacy:** `POST /sales/:id/refund` still on sales controller
- **Frontend:** `RefundsPage`, `RefundModal`, `RefundApprovalSection`
- **Approval:** Manager approval ID or NFC per store setting

### 7.6 Reports

- **Route:** `/reports`
- **Backend:** `reports.controller.ts` — 20+ report endpoints (daily/monthly sales, profit, best sellers, low stock, refunds, customer debts, P&L, etc.)

### 7.7 Offline Sync

- **Route:** `/offline-queue`
- **Status:** Partial — Dexie queue for failed sales sync; not full offline POS

### 7.8 License / Billing

- **Routes:** `/license`, `/billing` (OWNER only for billing)
- **Backend:** `license/`, tenant subscription status

---

## 8. Food & Beverage Module

### 8.1 Feature Guard

F&B endpoints use `@RequireFeature()` from `fnb/feature/` — checks plan/client features.

### 8.2 Implemented Features

| Feature | Backend Module | Frontend Route | Status |
|---------|----------------|----------------|--------|
| F&B Dashboard | `fnb/reports/` | `/fnb/dashboard` | Implemented |
| Tables & dining areas | `fnb/tables/` | `/fnb/tables` | Implemented |
| F&B POS | `fnb/orders/` | `/fnb/pos` | Implemented |
| Orders (dine-in/takeaway/delivery) | `fnb/orders/orders.service.ts` | FnbPosPage | Implemented |
| Menu items | `fnb/menu/` | `/fnb/menu` | Implemented |
| Modifiers | `fnb/menu/modifier-groups` | `/fnb/modifiers` | Implemented |
| Kitchen display | `fnb/kitchen/` | `/fnb/kitchen` | Implemented |
| Recipes & ingredients | `fnb/recipes/`, `fnb/ingredients/` | `/fnb/recipes`, `/fnb/ingredients` | Implemented |
| Recipe stock deduction | `recipes.service.ts` | — | Implemented |
| Waste tracking | `fnb/waste/` | `/fnb/waste` | Implemented |
| Delivery assignments | `fnb/delivery/` | `/fnb/delivery` | Implemented |
| Reservations | `fnb/reservations/` | `/fnb/reservations` | Implemented |
| F&B Reports | `fnb/reports/` | `/fnb/reports` | Implemented |
| Order payment/settle | `orders.service.ts` | FnbPosPage | Implemented |
| Refunds | `refunds/` source `FNB_ORDER` | RefundsPage | Implemented |

### 8.3 Not Implemented

| Feature | Status |
|---------|--------|
| Tips | **Missing** — no schema fields |
| Service charge | **Missing** — no schema fields |

### 8.4 F&B Roles

- **WAITER:** Tables, order create/update
- **CASHIER:** Order pay, print
- **KITCHEN:** Kitchen tickets
- **DELIVERY_DRIVER:** Delivery page

### 8.5 Database Models (F&B)

All include `clientId`: `DiningArea`, `RestaurantTable`, `MenuItem`, `ModifierGroup`, `Modifier`, `FnbOrder`, `FnbOrderItem`, `KitchenTicket`, `Reservation`, `Recipe`, `Waste`, `DeliveryAssignment`, `IngredientMovement`

---

## 9. Wholesale / B2B Module

### 9.1 Architecture

Wholesale = **Retail core** (shared routes under `/wholesale/*`) + **B2B document workflow**.

Official invoices are stored as **`Sale`** records (not a separate OfficialInvoice model). Invoice numbers use `StoreSettings.invoicePrefix`.

### 9.2 Document Workflow

| Document | Model | Stock | Revenue | Refundable | Printable |
|----------|-------|-------|---------|------------|-----------|
| Quotation | `Quotation` | No | No | No (cancel only) | Yes |
| Proforma | `ProformaInvoice` | No* | No | No (cancel only) | Yes |
| Official Invoice | `Sale` | Yes | Yes | Yes | Yes |
| Delivery Note | `DeliveryNote` | No** | No | N/A | Yes |

\*Optional stock reservation if enabled (`StockReservation` from proforma)  
\*\*Delivery note tracks fulfillment; stock deducted on official invoice

### 9.3 Conversions

`QuotationsController`:

- `POST /quotations/:id/convert-to-proforma`
- `POST /quotations/:id/convert-to-invoice` → creates `Sale`, sets `sourceQuotationId`
- Proforma → invoice conversion via proforma service

### 9.4 Wholesale-Specific Features

| Feature | Backend | Frontend | Status |
|---------|---------|----------|--------|
| Dashboard | `wholesale/reports/` | `/wholesale/dashboard` | Implemented |
| Quotations | `quotations/` | `/wholesale/quotations` | Implemented |
| Proforma | `proforma-invoices/` | `/wholesale/proforma-invoices` | Implemented |
| Official invoices | `sales/` | `/wholesale/invoices`, `/wholesale/invoices/new` | Implemented |
| Bulk pricing / price lists | `wholesale/bulk-pricing/`, `price-lists/` | `/wholesale/bulk-pricing` | Implemented |
| Payment terms | `customers/` + credit | `/wholesale/payment-terms` | Implemented |
| Customer statements | `wholesale/customer-credit/` | `/wholesale/customer-statements` | Implemented |
| Delivery notes | `wholesale/delivery-notes/` | `/wholesale/delivery-notes` | Implemented |
| Stock reservations | `wholesale/stock-reservations/` | `/wholesale/stock-reservations` | Implemented |
| Customer credit | `CustomerCreditProfile`, ledger | CustomerDetailPage | Implemented |
| B2B approval workflow | `wholesale/approvals/` | — | Partial (backend API) |
| Wholesale reports | `wholesale/reports/` | `/wholesale/reports` | Implemented |
| Print data API | `wholesale/print/b2b-print.controller.ts` | `B2bPrintPage` | Implemented |

### 9.5 Print Endpoints (read-only)

| Method | URL |
|--------|-----|
| GET | `/wholesale/print/quotations/:id/print-data` |
| GET | `/wholesale/print/proforma-invoices/:id/print-data` |
| GET | `/wholesale/print/invoices/:id/print-data` |

Printing never mutates stock, payment, or document status.

---

## 10. Notifications & Email

### 10.1 Notification Types (implemented in schema)

`LOW_STOCK`, `PASSWORD_RESET`, `PURCHASE_COMPLETED`, `SUBSCRIPTION_EXPIRING_48H`, `SUBSCRIPTION_EXPIRING_24H`, `WELCOME_MESSAGE`, `USER_CREATED`, `STOCK_ADDED`, `SUBSCRIPTION_RENEWED_INVOICE`, `PAYMENT_RECEIVED`, `CUSTOMER_OVERDUE`, `OFFICIAL_INVOICE_CREATED`, `DEVICE_ACTIVATED`, `REFUND_COMPLETED`, `LARGE_STOCK_ADJUSTMENT`, `QUOTATION_ACCEPTED`, `COMMISSION_APPROVED`, `COMMISSION_PAID`

### 10.2 Recipient Resolution

**Service:** `NotificationRecipientService` (`backend/src/notifications/notification-recipient.service.ts`)

Rules:
- Same client only
- Active users only
- Verified emails only (`emailVerified: true`)
- Role toggles: owner, general manager, co-manager
- Optional `selectedUserIds` JSON array
- Master switch: preference `enabled`
- Deduplication by email

### 10.3 Triggers

| Event | Type | Service |
|-------|------|---------|
| Stock crosses low threshold (downward) | LOW_STOCK | `stock.service.ts` |
| Stock added/increased | STOCK_ADDED | `stock.service.ts` |
| Sale completed | PURCHASE_COMPLETED | `sales.service.ts` |
| F&B order settled | PURCHASE_COMPLETED | `orders.service.ts` |
| Password reset | PASSWORD_RESET | `auth.service.ts` |
| First payment / renewal | WELCOME_MESSAGE, SUBSCRIPTION_RENEWED_INVOICE | `public.service.ts` |
| User created | USER_CREATED | `users.service.ts` |
| Quotation accepted | QUOTATION_ACCEPTED | `quotations.service.ts` |
| Refund completed | REFUND_COMPLETED | `refund.service.ts` |
| Commission approved/paid | COMMISSION_* | `commissions.service.ts` |
| Subscription expiry | SUBSCRIPTION_EXPIRING_* | `notification-cron.service.ts` hourly |

**Not triggered:** `CUSTOMER_OVERDUE` — enum exists, no cron found.

### 10.4 Anti-Spam (Low Stock)

Low stock notification sends only when quantity **crosses from above to at or below** threshold (not on every sale while already low).

### 10.5 UI

- `/settings/notifications` — `NotificationSettingsPage`
- `/wholesale/settings/notifications` — same component
- OWNER can edit; others read-only
- Warning when no recipients configured

### 10.6 Email

**Module:** `backend/src/email/email.service.ts`  
**Templates:** `email.templates.ts`  
**Env:** SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, FRONTEND_URL  
**Security:** OTP/passwords not logged; Pino redacts Authorization header

---

## 11. OTP & Security

### 11.1 OTP Model

`OtpCode` — hashed code, purpose (`EMAIL_VERIFICATION`, `PASSWORD_RESET`), expiry, attempts, single-use.

**Service:** `backend/src/otp/otp.service.ts`

| Rule | Implementation |
|------|----------------|
| Code hashed | SHA-256 + pepper |
| Not returned from API | ✓ |
| Not logged | ✓ |
| Expiry | Configurable (minutes) |
| Attempt limit | Max attempts then invalidate |
| Resend cooldown | Enforced in OtpService |

### 11.2 Flows

| Flow | Endpoints |
|------|-----------|
| Email verification (registration) | POST `/public/verify-email-otp`, `/public/resend-email-otp` |
| Forgot password | POST `/auth/forgot-password` → OTP email |
| Reset password | POST `/auth/reset-password` with OTP |

Forgot password returns generic success even if email unknown (no enumeration).

### 11.3 Login Security

- Account lockout after 5 failed attempts for 15 minutes
- Optional `clientSlug` scopes login to tenant
- Inactive/unverified clients blocked at login
- Refresh token stored hashed on user record

---

## 12. Refunds, Approvals, NFC, Commission

### 12.1 Unified Refund System

**Controller:** `backend/src/refunds/refund.controller.ts`

| Method | URL | Purpose |
|--------|-----|---------|
| GET | `/refunds` | List refunds |
| GET | `/refunds/refundable/:sourceType/:sourceId` | Refundable lines |
| GET | `/refunds/:id` | Detail |
| POST | `/refunds/preview` | Preview amounts |
| POST | `/refunds` | Complete refund |

**Source types:** `RETAIL_SALE`, `FNB_ORDER`, `WHOLESALE_INVOICE` (official invoice = Sale)

**Refund types:** FULL, PARTIAL — item/qty level via `RefundItem`

**Restock actions:** RESTOCK, DAMAGED, DISCARD, NO_RESTOCK → maps to `StockMovementType`

**Cannot refund:** Quotation, Proforma (cancel only)

### 12.2 Manager Approval ID — **Implemented**

- **Format:** `NORMALIZEDNAME@12345` (e.g. `ALIAHMAD@48291`)
- **Assigned to:** GENERAL_MANAGER, CO_MANAGER (via `ApprovalIdService`)
- **User fields:** `approvalIdCode` unique per client
- **Refund fields:** `approvedByUserId`, `approvedByApprovalIdCodeSnapshot`, `approvedAt`
- **API:** `GET /users/approval-lookup`, `PATCH /users/:id/regenerate-approval-id` (OWNER)
- **Validation:** `POST /approvals/validate`

### 12.3 NFC Approval — **Implemented**

**Store setting:** `StoreSettings.refundApprovalMethod`

| Value | Behavior |
|-------|----------|
| APPROVAL_ID | Default — manager types approval ID |
| NFC_CARD | Scan NFC UID only |
| NFC_CARD_AND_PIN | UID + PIN (bcrypt hashed) |

**User fields:** `nfcCardUid`, `nfcEnabled`, `approvalPinHash`  
**Security note:** NFC UID alone is weaker than NFC + PIN (documented in settings UI)

### 12.4 Salesman ID — **Implemented**

- **Format:** `NAME-1234` (normalized name + 4 digits)
- **Assigned to:** SALESMAN role only
- **Field:** `User.salesmanIdCode`, `Sale.salesmanId`
- **Cashier flow:** Must enter salesman ID on retail/wholesale sale when applicable
- **API:** `GET /users/salesmen/lookup`, `PATCH /users/:id/regenerate-salesman-id`

### 12.5 Commission — **Implemented**

**Model:** `SalesCommission`

| Field | Purpose |
|-------|---------|
| commissionType | PERCENTAGE, FIXED_PER_SALE, NONE |
| sourceType | RETAIL_SALE, WHOLESALE_INVOICE |
| status | PENDING, APPROVED, PAID, CANCELLED, ADJUSTED |

- Accrues on completed retail sale and wholesale official invoice
- **No commission** on quotation/proforma
- Refund adjusts/cancels commission via `SalesCommissionService`
- **API:** `/commissions` — list, summary, approve, mark-paid, cancel
- **Frontend:** `/commissions`, `/wholesale/commissions`
- **Permissions:** OWNER/GM approve & pay; SALESMAN views own

---

## 13. Reports & Printing

### 13.1 Printable Documents

| Document | Print Route | Backend Print Data | Status |
|----------|-------------|-------------------|--------|
| Retail receipt | `/sales/:id/print` | Sale detail API | Implemented |
| F&B receipt | FnbPosPage inline | Order API | Implemented |
| Quotation | `/quotations/:id/print`, `/wholesale/quotations/:id/print` | B2B print API | Implemented |
| Proforma | `/proforma-invoices/:id/print` | B2B print API | Implemented |
| Official invoice | `/wholesale/invoices/:id/print` | B2B print API | Implemented |
| Delivery note | — | delivery note detail | Partial (no dedicated print route) |
| Customer statement | CustomerStatementsPage | credit API | Partial |
| Refund receipt | — | — | **Missing dedicated print page** |
| Subscription invoice | Email only | notification | Partial |

**Rule:** All print flows are read-only — no stock/payment/status mutation.

### 13.2 Dashboards Summary

See Sections 7, 8, 9, 4.7 for module-specific dashboards.

**SaaS dashboard:** Client counts, expiring subscriptions, revenue metrics (`SaasDashboardPage`).

---

## 14. API Endpoints

Base URL: `/api` prefix (if configured in main.ts) — verify `main.ts` global prefix.

### 14.1 Auth (`/auth`)

| Method | URL | Auth | Roles | Purpose |
|--------|-----|------|-------|---------|
| POST | `/auth/login` | Public | — | Login, returns JWT + dashboard URL |
| POST | `/auth/forgot-password` | Public | — | Send reset OTP |
| POST | `/auth/reset-password` | Public | — | Reset with OTP |
| POST | `/auth/refresh` | Public | — | Refresh tokens |
| GET | `/auth/me` | JWT | Any | User, permissions, branches, subscription |
| POST | `/auth/logout` | JWT | Any | Invalidate refresh |

### 14.2 Public (`/public`)

| Method | URL | Purpose |
|--------|-----|---------|
| GET | `/public/plans` | Active plans |
| POST | `/public/register` | Register tenant |
| POST | `/public/verify-email-otp` | Verify email |
| POST | `/public/resend-email-otp` | Resend OTP |
| GET | `/public/payments/:id` | Payment status |
| POST | `/public/payments/:id/simulate-success` | Dev payment |

### 14.3 Sales (`/sales`) — tenant isolated via `user.clientId`

| Method | URL | Roles |
|--------|-----|-------|
| POST | `/sales` | OWNER, GM, CO_MANAGER, CASHIER, SALESMAN, ADMIN, MANAGER |
| GET | `/sales` | OWNER, ADMIN, MANAGER, CASHIER |
| GET | `/sales/:id` | Same |
| GET | `/sales/invoice/:invoiceNumber` | Same |
| POST | `/sales/:id/refund` | OWNER, GM, CO_MANAGER, ADMIN, MANAGER |
| GET | `/sales/filters/users` | OWNER, ADMIN, MANAGER |

### 14.4 Refunds (`/refunds`)

| Method | URL | Roles |
|--------|-----|-------|
| GET | `/refunds` | OWNER, GM, CO_MANAGER, ADMIN, MANAGER |
| POST | `/refunds` | Same |
| POST | `/refunds/preview` | Same |
| GET | `/refunds/refundable/:sourceType/:sourceId` | Same |

### 14.5 Products, Stock, Customers, etc.

Pattern: All `@UseGuards(JwtAuthGuard, RolesGuard)` controllers filter by `user.clientId` in services.

Key controllers: `products`, `categories`, `stock/movements`, `customers`, `suppliers`, `purchase-orders`, `branches`, `stock-transfers`, `users`, `settings`, `reports`, `commissions`, `approvals`.

### 14.6 F&B (`/fnb/*`)

Controllers under `backend/src/fnb/` — orders, tables, menu, kitchen, recipes, ingredients, waste, delivery, reservations, reports. Protected by JWT + `@RequireFeature`.

### 14.7 Wholesale (`/wholesale/*`, `/quotations`, `/proforma-invoices`)

| Module | Base path |
|--------|-----------|
| Quotations | `/quotations` |
| Proforma | `/proforma-invoices` |
| Bulk pricing | `/wholesale/bulk-pricing` |
| Price lists | `/wholesale/price-lists` |
| Delivery notes | `/wholesale/delivery-notes` |
| Stock reservations | `/wholesale/stock-reservations` |
| Customer credit | `/wholesale/customers` |
| Print | `/wholesale/print` |
| Reports | `/wholesale/reports` |
| Approvals | `/wholesale/approvals` |

### 14.8 SaaS Admin (`/saas/*`)

Separate JWT — clients, plans, subscriptions, devices, activation codes, audit logs.

### 14.9 Notifications

| Method | URL | Roles |
|--------|-----|-------|
| GET | `/notification-preferences` | OWNER, GM (view) |
| PATCH | `/notification-preferences` | OWNER |

### 14.10 Permissions

| Method | URL | Purpose |
|--------|-----|---------|
| GET | `/permissions/me` | Current user permissions |
| GET | `/permissions/roles` | Role catalog for business type |

---

## 15. Database Models & Enums

### 15.1 Tenant-Owned Models (contain `clientId`)

**Direct clientId:**

Client (root), User, Branch, Category, Supplier, Product, Customer, CustomerLedger, Sale, StockMovement, StockTransfer, PurchaseOrder, Refund, SalesCommission, Shift, Expense, Coupon, StoreSettings, NotificationPreference, SubscriptionNotificationLog, OtpCode, DiningArea, RestaurantTable, MenuItem, ModifierGroup, Modifier, FnbOrder, Quotation, QuotationItem, ProformaInvoice, ProformaInvoiceItem, StockReservation, CustomerCreditProfile, PriceList, DeliveryNote, DocumentCounter, Waste, DeliveryAssignment, IngredientMovement, ApprovalRequest, PaymentRecord, Device

**Child models (tenant via parent):** SaleItem, Payment, RefundItem, StockTransferItem, PurchaseOrderItem, FnbOrderItem, KitchenTicket, Recipe, PriceListItem, DeliveryNoteItem, BranchStock

**Nullable clientId:** AuditLog, ActivationCode (pre-assignment)

**SaaS-global (no tenant):** Plan, SaaSAdmin

### 15.2 Key Enums (48 total)

See `backend/prisma/schema.prisma` lines 11–1677 for full list.

| Enum | Key values |
|------|------------|
| BusinessType | RETAIL, FOOD_BEVERAGE, WHOLESALE, HYBRID |
| UserRole | OWNER, GENERAL_MANAGER, CO_MANAGER, CASHIER, SALESMAN, STOCK_MANAGER, WAITER, KITCHEN, DELIVERY_DRIVER, ADMIN*, MANAGER* |
| ClientStatus | ACTIVE, PENDING_EMAIL_VERIFICATION, PENDING_PAYMENT, SUSPENDED, INACTIVE |
| SubscriptionStatus | ACTIVE, TRIALING, EXPIRED, SUSPENDED, PENDING_PAYMENT, PAST_DUE, CANCELLED, LIFETIME |
| RefundSourceType | RETAIL_SALE, FNB_ORDER, WHOLESALE_INVOICE |
| RefundApprovalMethod | APPROVAL_ID, NFC_CARD, NFC_CARD_AND_PIN |
| QuotationStatus | DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED, CONVERTED, CANCELLED |
| ProformaInvoiceStatus | DRAFT, SENT, ACCEPTED, CONVERTED, CANCELLED, EXPIRED |

### 15.3 Tenant Isolation Strategy

1. JWT payload includes `clientId` — set in `JwtStrategy`
2. All service methods accept `user.clientId` or `SafeUser` and add `where: { clientId }`
3. Unique constraints scoped per client: `(clientId, invoiceNumber)`, `(clientId, barcode)`, etc.
4. Cross-client access prevented by UUID + clientId compound queries
5. Branch scope: `BranchScopeService.resolveBranchId()` validates user branch access

**Test coverage:** `backend/src/__tests__/tenant-isolation.spec.ts`

**Review items:**

- Some F&B queries filter by `branchId` — must ensure branch belongs to client
- AuditLog allows null clientId for system events
- Activation codes may exist before client assignment

---

## 16. Frontend Pages & Components

### 16.1 Public Routes

| Route | Component |
|-------|-----------|
| `/` | LandingPage |
| `/login` | LoginPage |
| `/forgot-password` | ForgotPasswordPage |
| `/reset-password` | ResetPasswordPage |
| `/get-started` | GetStartedPage |
| `/register` | RegisterPage |
| `/verify-email` | VerifyEmailPage |
| `/pricing` | PricingPage |
| `/payment` | PaymentPage |
| `/payment-success` | PaymentSuccessPage |
| `/download` | DownloadPage |
| `/activate` | ActivateLicensePage |

### 16.2 Retail Routes (protected)

`dashboard`, `pos`, `products`, `product-labels`, `categories`, `stock-movements`, `purchases`, `suppliers`, `sales`, `commissions`, `refunds`, `customers`, `branches`, `stock-transfers`, `reports`, `users`, `settings`, `settings/notifications`, `billing`, `coupons`, `quotations`, `proforma-invoices`, `offline-queue`, `license`

### 16.3 F&B Routes

`/fnb/dashboard`, `/fnb/pos`, `/fnb/tables`, `/fnb/kitchen`, `/fnb/menu`, `/fnb/modifiers`, `/fnb/ingredients`, `/fnb/recipes`, `/fnb/waste`, `/fnb/delivery`, `/fnb/reservations`, `/fnb/reports`

### 16.4 Wholesale Routes

`/wholesale/dashboard`, `/wholesale/quotations`, `/wholesale/proforma-invoices`, `/wholesale/invoices`, `/wholesale/invoices/new`, `/wholesale/bulk-pricing`, `/wholesale/delivery-notes`, `/wholesale/payment-terms`, `/wholesale/customer-statements`, `/wholesale/stock-reservations`, `/wholesale/reports`, `/wholesale/commissions`

Plus shared: `/wholesale/products`, `/wholesale/pos`, `/wholesale/sales`, etc. via `wholesale-shared-routes.tsx`

### 16.5 SaaS Admin Routes

`/saas/login`, `/saas/dashboard`, `/saas/clients`, `/saas/plans`, `/saas/subscriptions`, `/saas/devices`, `/saas/activation-codes`, `/saas/audit-logs`, `/saas/settings`, `/saas/clients/:id/*`

### 16.6 Shared Components

| Category | Examples |
|----------|----------|
| Layout | `AppLayout`, `SaasLayout`, sidebar nav |
| Auth | `ProtectedRoute`, `RoleRoute`, `SessionGate` |
| Refunds | `RefundModal`, `RefundApprovalSection`, `NfcScanInput` |
| Print | `B2bPrintPage` |
| Theme | `ThemeToggle` |
| Users | `EditUserModal` (NFC, approval ID, commission) |

### 16.7 State Management

- **Auth:** React Context (`AuthContext`) — user, permissions, branches, businessType
- **Branch:** Header/context for active branch (`x-branch-id`)
- **No Redux** — local state + React Query patterns in API modules

---

## 17. Testing & Build Status

### 17.1 Backend Tests (16 suites, 133 tests — all passing)

| File | Focus |
|------|-------|
| `tenant-isolation.spec.ts` | Cross-tenant access prevention |
| `auth-service.spec.ts` | Login, lockout |
| `otp.service.spec.ts` | OTP hashing, expiry |
| `notification-recipients.spec.ts` | Recipient resolver |
| `permissions.service.spec.ts` | Role grants |
| `approval-id.service.spec.ts` | Approval ID format/uniqueness |
| `nfc-approval.util.spec.ts` | NFC UID normalize/hash |
| `refund-approval.service.spec.ts` | Refund approval validation |
| `salesman-id.service.spec.ts` | Salesman ID generation |
| `sales-commission.service.spec.ts` | Commission accrual/adjustment |
| `sales-pricing.spec.ts` | Pricing logic |
| `stock-adjustment.spec.ts` | Stock adjustments |
| `fnb/orders.service.spec.ts` | F&B orders |
| `fnb/menu.service.spec.ts` | Menu |
| `fnb/recipes.service.spec.ts` | Recipes |
| `fnb/tables.service.spec.ts` | Tables |

### 17.2 Missing Tests

- Subscription expiry cron integration
- Public registration E2E
- Wholesale document conversion flows
- Refund restock edge cases
- Frontend tests (none found)
- Payment gateway (N/A — not implemented)

### 17.3 Build Status

- Backend: `npm run build` — OK
- Frontend: `npm run build` — OK

---

## 18. Missing Features / TODOs

| Feature | Status | Why It Matters | Priority |
|---------|--------|----------------|----------|
| Real payment gateway + webhook | Missing | Cannot bill in production | **Critical** |
| Device plan limit enforcement | Partial (`assertCanRegisterDevice` not wired) | Plan limits bypass | **High** |
| CUSTOMER_OVERDUE notification cron | Missing trigger | Overdue invoices not emailed | **High** |
| Refund receipt print page | Missing | Operational gap at register | **Medium** |
| Frontend PermissionRoute wiring | Partial | Role-only FE guards inconsistent with backend | **High** |
| Wholesale shared routes in ROUTE_PERMISSIONS | Missing entries | Permission map incomplete | **Medium** |
| Tips / service charge (F&B) | Missing | Restaurant standard feature | **Medium** |
| Delivery note print route | Partial | B2B fulfillment docs | **Medium** |
| SaaS settings page | Placeholder | Super admin config | **Low** |
| Expenses frontend page | Missing | Backend exists | **Low** |
| Full offline POS | Partial | Queue only | **Low** |
| Error monitoring (Sentry etc.) | Missing | Production ops | **High** |
| Automated backup strategy | Missing | Data safety | **High** |
| E2E test suite | Missing | Regression safety | **Medium** |

---

## 19. Recommended Implementation Roadmap

### Phase 1 — Critical Production Blockers
1. Integrate real payment provider (Stripe/local) with webhook handler
2. Replace `simulate-success` with production checkout flow
3. SMTP production configuration and deliverability testing

### Phase 2 — Security & Tenant Isolation
1. Audit all F&B/wholesale services for branchId → clientId validation
2. Wire `PermissionsGuard` consistently on all mutating endpoints
3. Wire frontend `PermissionRoute` using `ROUTE_PERMISSIONS`
4. Security review of SaaS admin vs store JWT separation

### Phase 3 — Payment Gateway Completion
1. Webhook: payment succeeded → activate/renew subscription
2. Webhook: payment failed → PAST_DUE handling
3. Billing page: real invoice history from PaymentRecord

### Phase 4 — Role/Permission Completion
1. Align frontend RoleRoute arrays with GENERAL_MANAGER/CO_MANAGER naming
2. Complete wholesale shared route permission map
3. Document and test CO_MANAGER vs GM refund approve differences

### Phase 5 — Refunds & Approval
1. Dedicated refund receipt print page/route
2. Refund history in reports (partially exists via `/reports/refunds`)

### Phase 6 — Commission
1. Commission report dashboard widgets
2. Payroll export (CSV)

### Phase 7 — NFC Optional Approval
1. Already implemented — add hardware integration docs
2. Owner training materials for NFC+PIN recommendation

### Phase 8 — Reports
1. CUSTOMER_OVERDUE cron + report
2. Delivery note print template
3. Unified executive dashboard for HYBRID tenants

### Phase 9 — Testing
1. Cron integration tests
2. Registration → payment E2E
3. Frontend component tests for critical flows

### Phase 10 — Deployment Readiness
1. Wire device limit on activation
2. Monitoring + alerting
3. Database backup automation
4. Load testing on multi-tenant queries

---

*End of report — generated from codebase inspection on 2026-06-12.*
