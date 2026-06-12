import { API_URL } from '@/lib/env';
import { api } from '@/api/client';

export type ActivateLicenseBody = {
  /** Full activation code as shown (e.g. POS-…); not truncated. */
  activationCode: string;
  deviceId: string;
  deviceName?: string;
  platform?: string;
  businessName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
};

export type ActivateLicenseResponse = {
  licenseToken: string;
  publicKeyPem: string;
  clientId: string;
  clientSlug: string | null;
  licenseId: string;
  deviceId: string;
  plan: string;
  expiresAt: string;
  graceDays: number;
  /** Null = unlimited (Desktop Lifetime). */
  maxBranches: number | null;
  maxDevices: number | null;
  lexp: number;
};

type ActivateDeviceApiResponse = {
  licenseToken: string;
  publicKeyPem: string;
  client: {
    id: string;
    slug: string;
    businessName: string;
    email: string;
  };
  subscriptionExpiresAt: string;
  graceDays: number;
  maxDevices: number | null;
  maxBranches: number | null;
  plan: string;
  lexp: number;
};

type ActivateLicenseLegacyResponse = ActivateLicenseResponse;

function detectPlatform(): string {
  if (typeof navigator === 'undefined') {
    return 'web';
  }
  const ua = navigator.userAgent;
  if (/electron/i.test(ua)) {
    return 'electron';
  }
  if (/android/i.test(ua)) {
    return 'android';
  }
  if (/iphone|ipad|ipod/i.test(ua)) {
    return 'ios';
  }
  return 'web';
}

function parseActivationError(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const body = data as { message?: string | string[]; code?: string };
    const msg = body.message;
    if (typeof msg === 'string' && msg.trim()) {
      return msg;
    }
    if (Array.isArray(msg) && typeof msg[0] === 'string') {
      return msg[0];
    }
    if (body.code === 'ACTIVATION_FAILED') {
      return 'Activation could not be completed. Check your code and try again.';
    }
    if (body.code === 'LICENSE_BYPASS_ACTIVE') {
      return 'License activation is disabled on this server (BYPASS_LICENSE).';
    }
    if (body.code === 'ACTIVATION_CODE_CLIENT_BOUND') {
      return 'This code is for an existing store. Use the full code on this page without extra business fields.';
    }
  }
  if (status === 401) {
    return 'Activation could not be completed. Check your code and try again.';
  }
  return 'Activation failed. Please try again.';
}

/**
 * Activates a device with a client-bound code (from SaaS /saas/clients/:id/activation-codes).
 * Uses public POST /activation/activate-device (no login required).
 */
export async function activateLicenseRequest(body: ActivateLicenseBody): Promise<ActivateLicenseResponse> {
  const activationCode = body.activationCode.trim();
  if (!activationCode) {
    throw new Error('Activation code is required');
  }

  const payload = {
    activationCode,
    deviceId: body.deviceId.trim(),
    deviceName: body.deviceName?.trim() || 'POS Terminal',
    platform: body.platform?.trim() || detectPlatform(),
  };

  const res = await fetch(`${API_URL}/activation/activate-device`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json().catch(() => ({}))) as ActivateDeviceApiResponse & {
    message?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new Error(parseActivationError(data, res.status));
  }

  return {
    licenseToken: data.licenseToken,
    publicKeyPem: data.publicKeyPem,
    clientId: data.client.id,
    clientSlug: data.client.slug ?? null,
    licenseId: '',
    deviceId: body.deviceId,
    plan: data.plan,
    expiresAt: data.subscriptionExpiresAt,
    graceDays: data.graceDays,
    maxBranches: data.maxBranches,
    maxDevices: data.maxDevices,
    lexp: data.lexp,
  };
}

/**
 * Legacy unbound activation (creates a new client from code + business profile).
 * Only used when codes are not tied to an existing client.
 */
export async function activateUnboundLicenseRequest(
  body: ActivateLicenseBody,
): Promise<ActivateLicenseResponse> {
  const res = await fetch(`${API_URL}/license/activate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Request-Id': crypto.randomUUID(),
    },
    body: JSON.stringify({
      activationCode: body.activationCode.trim(),
      deviceId: body.deviceId.trim(),
      deviceName: body.deviceName?.trim() || undefined,
      businessName: body.businessName?.trim() || undefined,
      ownerName: body.ownerName?.trim() || undefined,
      email: body.email?.trim() || undefined,
      phone: body.phone?.trim() || undefined,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as ActivateLicenseLegacyResponse & {
    message?: string;
    code?: string;
  };

  if (!res.ok) {
    throw new Error(parseActivationError(data, res.status));
  }

  return data;
}

export async function pingLicense(): Promise<unknown> {
  const { data } = await api.post('/license/ping');
  return data;
}

export type DesktopDownloadInfo = {
  available: boolean;
  downloadUrl?: string;
  message?: string;
  businessType: 'RETAIL' | 'FOOD_BEVERAGE' | 'WHOLESALE' | 'HYBRID';
  planCode: string;
  /** Null = unlimited devices (Desktop Lifetime). */
  maxDevices: number | null;
};

/** Desktop installer info for the signed-in tenant (plan must include desktop_download). */
export async function fetchDesktopDownload(): Promise<DesktopDownloadInfo> {
  const { data } = await api.get<DesktopDownloadInfo>('/license/download-desktop');
  return data;
}

export async function refreshLicense(): Promise<{ licenseToken: string; publicKeyPem: string; lexp: number }> {
  const { data } = await api.post('/license/refresh');
  return data as { licenseToken: string; publicKeyPem: string; lexp: number };
}
