import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port: Number.parseInt(process.env.PORT ?? '3000', 10),
    /** Comma-separated origins, or `*` (development only — blocked in production by Joi). */
    corsOrigin: (process.env.CORS_ORIGIN ?? '*').trim() || '*',
  };
});
