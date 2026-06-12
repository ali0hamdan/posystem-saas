import { BadRequestException } from '@nestjs/common';
import {
  assertValidApprovalPin,
  assertValidNfcCardUid,
  hashNfcCardUid,
  maskNfcCardUid,
  normalizeNfcCardUid,
} from '../common/utils/nfc-approval.util';

describe('nfc-approval.util', () => {
  it('normalizes NFC UID', () => {
    expect(normalizeNfcCardUid(' 04a3-917b-221890 ')).toBe('04A3917B221890');
  });

  it('masks NFC UID for display', () => {
    expect(maskNfcCardUid('04A3917B221890')).toBe('NFC card ending in 1890');
  });

  it('hashes NFC UID with client scope', () => {
    const h1 = hashNfcCardUid('client-a', '04A3917B221890');
    const h2 = hashNfcCardUid('client-b', '04A3917B221890');
    expect(h1).not.toBe(h2);
    expect(h1).toHaveLength(64);
  });

  it('validates approval PIN length', () => {
    expect(assertValidApprovalPin('1234')).toBe('1234');
    expect(() => assertValidApprovalPin('12')).toThrow(BadRequestException);
  });

  it('rejects invalid NFC UID', () => {
    expect(() => assertValidNfcCardUid('abc')).toThrow(BadRequestException);
  });
});
