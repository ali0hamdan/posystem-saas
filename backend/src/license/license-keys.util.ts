/** Decode base64 env value to PEM text; returns empty string if missing or invalid. */
export function decodeLicenseKeyPemFromB64(b64: string | undefined): string {
  const trimmed = (b64 ?? '').trim();
  if (!trimmed) {
    return '';
  }
  try {
    const pem = Buffer.from(trimmed, 'base64').toString('utf8');
    if (!pem.includes('BEGIN') || !pem.includes('KEY')) {
      return '';
    }
    return pem;
  } catch {
    return '';
  }
}

export function hasLicenseSigningKeyPair(
  privateB64: string | undefined,
  publicB64: string | undefined,
): boolean {
  return Boolean(decodeLicenseKeyPemFromB64(privateB64) && decodeLicenseKeyPemFromB64(publicB64));
}
