# Stock POS — User & operator documentation

Welcome. These guides are written for day-to-day use of the **Stock POS** web app (and optional **Electron** desktop build). Paths like `/pos` match the sidebar routes in the app.

## Guides

1. [Admin User Guide](./admin-user-guide.md)
2. [Cashier User Guide](./cashier-user-guide.md)
3. [Inventory Management Guide](./inventory-management-guide.md)
4. [Sales and Refunds Guide](./sales-and-refunds-guide.md)
5. [Shift Management Guide](./shift-management-guide.md)
6. [Customer Debt Guide](./customer-debt-guide.md)
7. [Purchase Orders Guide](./purchase-orders-guide.md)
8. [Reports Guide](./reports-guide.md)
9. [Printer Setup Guide](./printer-setup-guide.md)
10. [Backup and Restore Guide](./backup-and-restore-guide.md)
11. [Troubleshooting Guide](./troubleshooting-guide.md)

### Quick “who should read what?”

| Guide | Who it is for |
|--------|----------------|
| [Admin](./admin-user-guide.md) | Owners & administrators |
| [Cashier](./cashier-user-guide.md) | Front-line checkout |
| [Inventory](./inventory-management-guide.md) | Stock keepers, admins |
| [Sales & refunds](./sales-and-refunds-guide.md) | Managers + cashiers (read) |
| [Shifts](./shift-management-guide.md) | Supervisors, accounting |
| [Customer debt](./customer-debt-guide.md) | Managers, service desk |
| [Purchase orders](./purchase-orders-guide.md) | Buyers, admins |
| [Reports](./reports-guide.md) | Owners, admins |
| [Printer](./printer-setup-guide.md) | IT + store lead |
| [Backup](./backup-and-restore-guide.md) | IT, owners |
| [Troubleshooting](./troubleshooting-guide.md) | Everyone |

## Roles (quick reference)

| Role | Typical access |
|------|----------------|
| **OWNER** | Full store control: branches, users, settings, refunds, reports, purchases, inventory. |
| **ADMIN** | Almost everything **except** some owner-only limits; often restricted to managing **cashiers** only in user management. |
| **CASHIER** | Dashboard, POS, sales history, customers, branches; **no** refunds, **no** purchase orders, **no** store settings. |

If a menu item is missing, your role does not include that area.

## For developers

See the repository root **[README.md](../README.md)** (overview and scripts), **[INSTALLATION.md](../INSTALLATION.md)** (full setup), **[DEPLOYMENT.md](../DEPLOYMENT.md)** (production), and **[CHANGELOG.md](../CHANGELOG.md)** (release notes).
