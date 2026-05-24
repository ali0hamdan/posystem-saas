import { registerAs } from '@nestjs/config';

function boolEnv(name: string, defaultProd: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === '') {
    return process.env.NODE_ENV === 'production' ? defaultProd : false;
  }
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/** When true, Express `trust proxy` is enabled (required for correct client IP behind reverse proxies). */
export default registerAs('security', () => ({
  trustProxy: boolEnv('TRUST_PROXY', true),
}));
