import { ServiceUnavailableException } from '@nestjs/common';

function signingHint(): string {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd) {
    return 'Set LICENSE_RSA_PRIVATE_KEY_B64 and LICENSE_RSA_PUBLIC_KEY_B64 (base64-encoded PEM) in the server environment.';
  }
  return 'From the backend folder run: npm run license:keys — then paste the values into .env and restart the API.';
}

export class LicenseSigningNotConfiguredException extends ServiceUnavailableException {
  constructor(part: 'private' | 'public' | 'pair') {
    const detail =
      part === 'pair'
        ? 'LICENSE_RSA_PRIVATE_KEY_B64 and LICENSE_RSA_PUBLIC_KEY_B64 are not configured'
        : part === 'private'
          ? 'LICENSE_RSA_PRIVATE_KEY_B64 is not configured'
          : 'LICENSE_RSA_PUBLIC_KEY_B64 is not configured';

    super({
      message: `${detail}. ${signingHint()}`,
      code: 'LICENSE_SIGNING_NOT_CONFIGURED',
    });
  }
}
