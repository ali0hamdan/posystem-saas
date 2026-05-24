import { registerAs } from '@nestjs/config';
import { decodeLicenseKeyPemFromB64 } from '../license/license-keys.util';

export default registerAs('license', () => {
  const bypass =
    String(process.env.BYPASS_LICENSE ?? '')
      .trim()
      .toLowerCase() === 'true' ||
    String(process.env.BYPASS_LICENSE ?? '').trim() === '1';

  const privateB64 = (process.env.LICENSE_RSA_PRIVATE_KEY_B64 ?? '').trim();
  const publicB64 = (process.env.LICENSE_RSA_PUBLIC_KEY_B64 ?? '').trim();

  return {
    bypassLicense: bypass,
    rsaPrivateKeyPem: decodeLicenseKeyPemFromB64(privateB64),
    rsaPublicKeyPem: decodeLicenseKeyPemFromB64(publicB64),
    /** Cache DB validation result per token hash (ms) */
    validationCacheTtlMs: Number.parseInt(process.env.LICENSE_VALIDATION_CACHE_MS ?? '45000', 10),
  };
});
