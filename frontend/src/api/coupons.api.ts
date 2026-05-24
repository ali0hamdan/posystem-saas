import { api } from '@/api/client';

export type CouponType = 'PERCENTAGE' | 'FIXED';

export interface Coupon {
  id: string;
  clientId: string;
  code: string;
  type: CouponType;
  value: string;
  minOrderAmount: string | null;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponValidation {
  couponId: string;
  code: string;
  type: CouponType;
  value: string;
  discount: string;
}

export interface CreateCouponBody {
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  maxUses?: number;
  expiresAt?: string;
  isActive?: boolean;
}

export async function fetchCoupons(includeInactive = false): Promise<Coupon[]> {
  const { data } = await api.get<Coupon[]>('/coupons', {
    params: includeInactive ? { includeInactive: true } : {},
  });
  return data;
}

export async function createCoupon(body: CreateCouponBody): Promise<Coupon> {
  const { data } = await api.post<Coupon>('/coupons', body);
  return data;
}

export async function updateCoupon(id: string, body: Partial<Pick<Coupon, 'isActive' | 'maxUses' | 'expiresAt' | 'minOrderAmount'>>): Promise<Coupon> {
  const { data } = await api.patch<Coupon>(`/coupons/${id}`, body);
  return data;
}

export async function deleteCoupon(id: string): Promise<void> {
  await api.delete(`/coupons/${id}`);
}

export async function validateCoupon(code: string, orderAmount: number): Promise<CouponValidation> {
  const { data } = await api.post<CouponValidation>('/coupons/validate', { code, orderAmount });
  return data;
}
