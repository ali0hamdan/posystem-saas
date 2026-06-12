import type { CustomerRow } from '@/types/customers';

export function customerPickerLabel(c: Pick<CustomerRow, 'name' | 'companyName' | 'phone' | 'email'>): string {
  const parts = [c.name];
  if (c.companyName && c.companyName !== c.name) parts.push(`(${c.companyName})`);
  if (c.phone) parts.push(c.phone);
  if (c.email) parts.push(c.email);
  return parts.join(' · ');
}

export function customerStatusLabel(isActive: boolean): string {
  return isActive ? 'Active' : 'Inactive';
}
