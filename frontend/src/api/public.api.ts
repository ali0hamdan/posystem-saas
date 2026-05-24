import axios from 'axios';
import { API_URL } from '@/lib/env';
import { getApiErrorMessage } from '@/api/client';

const publicApi = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15_000,
});

export interface PublicPlan {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: 'SUBSCRIPTION' | 'ONE_TIME';
  monthlyPrice: string | null;
  yearlyPrice: string | null;
  oneTimePrice: string | null;
  currency: string;
  maxUsers: number;
  maxBranches: number;
  maxDevices: number;
  features: Record<string, boolean>;
  allowsDesktopDownload: boolean;
}

export interface RegisterPayload {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  phone?: string;
  planCode: string;
  billingCycle: 'MONTHLY' | 'YEARLY' | 'LIFETIME';
}

export interface RegisterResult {
  clientId: string;
  paymentId: string;
  amount: string;
  currency: string;
  planCode: string;
  billingCycle: string;
  businessName: string;
  username: string;
}

export interface PaymentStatus {
  paymentId: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  amount: string;
  currency: string;
  billingCycle: string;
  paidAt: string | null;
  planCode: string;
  planName: string;
  clientStatus: string;
  subscriptionStatus: string | null;
}

export interface SimulateResult {
  success: boolean;
  activationCode: string;
  subscriptionExpiresAt: string | null;
  planCode: string;
  username: string | null;
  message: string;
}

export async function fetchPublicPlans(): Promise<PublicPlan[]> {
  const { data } = await publicApi.get<PublicPlan[]>('/public/plans');
  return data;
}

export async function registerClient(payload: RegisterPayload): Promise<RegisterResult> {
  const { data } = await publicApi.post<RegisterResult>('/public/register', payload);
  return data;
}

export async function fetchPaymentStatus(paymentId: string): Promise<PaymentStatus> {
  const { data } = await publicApi.get<PaymentStatus>(`/public/payments/${paymentId}`);
  return data;
}

export async function simulatePaymentSuccess(paymentId: string): Promise<SimulateResult> {
  const { data } = await publicApi.post<SimulateResult>(
    `/public/payments/${paymentId}/simulate-success`,
  );
  return data;
}

export function getPublicApiError(error: unknown, fallback = 'Something went wrong'): string {
  return getApiErrorMessage(error, fallback);
}
