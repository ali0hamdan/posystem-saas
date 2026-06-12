import { api } from '@/api/client';

export type CustomerCreditProfile = {
  id: string;
  creditLimit: string;
  paymentTermsDays: number;
  isCreditAllowed: boolean;
  notes: string | null;
};

export async function listCustomerCreditProfiles() {
  const { data } = await api.get<
    { id: string; name: string; balance: string; creditProfile: CustomerCreditProfile | null }[]
  >('/wholesale/customers/credit-profiles');
  return data;
}

export async function upsertCustomerCreditProfile(
  customerId: string,
  body: { creditLimit: number; paymentTermsDays: number; isCreditAllowed?: boolean; notes?: string },
) {
  const { data } = await api.put<CustomerCreditProfile>(
    `/wholesale/customers/${customerId}/credit-profile`,
    body,
  );
  return data;
}

export async function fetchCustomerStatement(customerId: string, from?: string, to?: string) {
  const { data } = await api.get(`/wholesale/customers/${customerId}/statement`, {
    params: { from, to },
  });
  return data;
}
