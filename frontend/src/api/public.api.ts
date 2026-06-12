import axios from 'axios';
import { API_URL } from '@/lib/env';
import { getApiErrorMessage } from '@/api/client';
import type { BusinessType } from '@/types/tenant-context';

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
  /** When set, plan is offered only to this business type (e.g. Desktop Lifetime). */
  businessType: 'RETAIL' | 'FOOD_BEVERAGE' | 'WHOLESALE' | 'HYBRID' | null;
  isLifetime?: boolean;
  monthlyPrice: string | null;
  yearlyPrice: string | null;
  oneTimePrice: string | null;
  currency: string;
  /** Null = unlimited (Desktop Lifetime plans). */
  maxUsers: number | null;
  maxBranches: number | null;
  maxDevices: number | null;
  features: Record<string, boolean>;
  allowsDesktopDownload: boolean;
  sortOrder?: number;
}

export type OnboardingBusinessType = 'RETAIL' | 'FOOD_BEVERAGE' | 'WHOLESALE' | 'HYBRID';

export interface RegisterPayload {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
  phone?: string;
  planCode: string;
  billingCycle: 'MONTHLY' | 'YEARLY' | 'LIFETIME';
  businessType?: OnboardingBusinessType;
}

export interface RegisterResult {
  message: string;
  email: string;
  nextStep: 'VERIFY_EMAIL';
}

export interface VerifyEmailOtpResult {
  success: boolean;
  message: string;
  nextStep: 'PAYMENT';
  paymentId: string | null;
  businessType: BusinessType;
  planCode: string | null;
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
  isLifetime?: boolean;
  desktopDownloadEnabled?: boolean;
  unlimited?: boolean;
  maxDevices?: number | null;
  businessType?: BusinessType;
  clientStatus: string;
  subscriptionStatus: string | null;
}

export interface SimulateResult {
  success: boolean;
  clientId: string;
  activationCode: string;
  subscriptionExpiresAt: string | null;
  subscriptionStatus: string;
  planCode: string;
  planName: string;
  amount: string;
  currency: string;
  isLifetime: boolean;
  desktopDownloadEnabled: boolean;
  unlimited: boolean;
  maxDevices: number | null;
  businessType: BusinessType;
  ownerEmail: string;
  nextDashboardUrl: string;
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

export async function verifyEmailOtp(body: {
  email: string;
  otp: string;
}): Promise<VerifyEmailOtpResult> {
  const { data } = await publicApi.post<VerifyEmailOtpResult>('/public/verify-email-otp', {
    email: body.email.trim().toLowerCase(),
    otp: body.otp,
  });
  return data;
}

export async function resendEmailOtp(body: { email: string }): Promise<{ message: string }> {
  const { data } = await publicApi.post<{ message: string }>('/public/resend-email-otp', {
    email: body.email.trim().toLowerCase(),
  });
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
