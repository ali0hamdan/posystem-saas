import { Prisma } from '@prisma/client';

export const customerPublicSelect = {
  id: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  companyName: true,
  taxNumber: true,
  notes: true,
  isActive: true,
  balance: true,
  loyaltyPoints: true,
  createdAt: true,
  updatedAt: true,
  creditProfile: {
    select: {
      creditLimit: true,
      paymentTermsDays: true,
      isCreditAllowed: true,
    },
  },
} satisfies Prisma.CustomerSelect;

export type CustomerPublicRow = Prisma.CustomerGetPayload<{ select: typeof customerPublicSelect }>;

export function mapCustomerPublic(c: CustomerPublicRow) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    address: c.address,
    companyName: c.companyName,
    taxNumber: c.taxNumber,
    notes: c.notes,
    isActive: c.isActive,
    balance: c.balance,
    loyaltyPoints: c.loyaltyPoints,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    creditLimit: c.creditProfile?.creditLimit?.toString() ?? null,
    paymentTermsDays: c.creditProfile?.paymentTermsDays ?? null,
    isCreditAllowed: c.creditProfile?.isCreditAllowed ?? null,
  };
}
