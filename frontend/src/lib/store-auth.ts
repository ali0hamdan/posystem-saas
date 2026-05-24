import { useAuthStore } from '@/stores/auth-store';

/** Decode JWT payload (no signature verification — routing/guard use only). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** True when value looks like a store POS user JWT (not SaaS admin). */
export function isStoreAccessToken(token: string | null | undefined): token is string {
  if (typeof token !== 'string') return false;
  const t = token.trim();
  if (t.length < 32) return false;
  const payload = decodeJwtPayload(t);
  if (!payload) return false;
  const typ = payload.typ;
  if (typ === 'saas-admin') return false;
  if (typ !== undefined && typ !== 'store-user') return false;
  return true;
}

export function getStoreAccessToken(): string | null {
  const { accessToken } = useAuthStore.getState();
  return isStoreAccessToken(accessToken) ? accessToken.trim() : null;
}
