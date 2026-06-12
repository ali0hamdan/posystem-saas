import { createHash } from 'crypto';
import { compare, hash } from 'bcrypt';

const PIN_BCRYPT_ROUNDS = 10;
const PIN_PATTERN = /^\d{4,6}$/;

export function normalizeNfcCardUid(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-F0-9]/g, '');
}

export function maskNfcCardUid(raw: string): string {
  const uid = normalizeNfcCardUid(raw);
  if (!uid) return 'NFC card';
  if (uid.length <= 4) return `NFC card ending in ${uid}`;
  return `NFC card ending in ${uid.slice(-4)}`;
}

export function hashNfcCardUidSnapshot(clientId: string, raw: string): string {
  const uid = normalizeNfcCardUid(raw);
  return createHash('sha256').update(`${clientId}:${uid}`).digest('hex');
}

export function assertValidApprovalPin(pin: string): void {
  if (!PIN_PATTERN.test(pin)) {
    throw new Error('PIN must be 4-6 digits');
  }
}

export async function hashApprovalPin(pin: string): Promise<string> {
  assertValidApprovalPin(pin);
  return hash(pin, PIN_BCRYPT_ROUNDS);
}

export async function verifyApprovalPin(pin: string, pinHash: string | null | undefined): Promise<boolean> {
  if (!pinHash) return false;
  try {
    assertValidApprovalPin(pin);
  } catch {
    return false;
  }
  return compare(pin, pinHash);
}
