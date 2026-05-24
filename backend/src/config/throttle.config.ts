import { registerAs } from '@nestjs/config';

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export default registerAs('throttle', () => {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    /** Window length in milliseconds */
    ttlMs: intEnv('THROTTLE_TTL_MS', 60_000),
    /** Max requests per IP per window (global default; login uses stricter @Throttle) */
    limit: intEnv('THROTTLE_LIMIT', isProd ? 200 : 500),
  };
});
