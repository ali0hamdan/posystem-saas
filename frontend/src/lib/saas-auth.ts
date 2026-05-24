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

export function isSaasAccessToken(token: string | null | undefined): token is string {
  if (typeof token !== 'string') return false;
  const t = token.trim();
  if (t.length < 32) return false;
  const payload = decodeJwtPayload(t);
  return payload?.typ === 'saas-admin';
}
