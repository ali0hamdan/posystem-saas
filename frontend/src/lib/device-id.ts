const KEY = 'pos-device-id-v1';

export function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY)?.trim();
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return `dev-${Math.random().toString(36).slice(2)}`;
  }
}
