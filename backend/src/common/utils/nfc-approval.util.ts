import { createHash } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { compare, hash } from 'bcrypt';

const PIN_BCRYPT_ROUNDS = 10;
const PIN_PATTERN = /^\d{4,6}$/;

export function normalizeNfcCardUid(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-F0-9]/g, '');
}

export function assertValidNfcCardUid(raw: string | undefined): string {
  const uid = normalizeNfcCardUid(raw ?? '');
  if (!uid || uid.length < 4 || uid.length > 32) {
    throw new BadRequestException({
      message: 'Invalid NFC card.',
      code: 'INVALID_NFC_CARD',
    });
  }
  return uid;
}

export function maskNfcCardUid(uid: string): string {
  const normalized = normalizeNfcCardUid(uid);
  const suffix = normalized.length <= 4 ? normalized : normalized.slice(-4);
  return `NFC card ending in ${suffix}`;
}

export function hashNfcCardUid(clientId: string, uid: string): string {
  return createHash('sha256').update(`${clientId}:${normalizeNfcCardUid(uid)}`).digest('hex');
}

export function assertValidApprovalPin(raw: string | undefined): string {
  const pin = raw?.trim() ?? '';
  if (!PIN_PATTERN.test(pin)) {
    throw new BadRequestException({
      message: 'Approval PIN must be 4–6 digits.',
      code: 'INVALID_APPROVAL_PIN',
    });
  }
  return pin;
}

export async function hashApprovalPin(pin: string): Promise<string> {
  return hash(pin, PIN_BCRYPT_ROUNDS);
}

export async function verifyApprovalPin(pin: string, pinHash: string | null | undefined): Promise<boolean> {
  if (!pinHash) return false;
  return compare(pin, pinHash);
}
