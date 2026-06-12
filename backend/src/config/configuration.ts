import { registerAs } from '@nestjs/config';

export default registerAs('app', () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const appMode = (process.env.APP_MODE ?? '').trim().toLowerCase();
  const desktopMode =
    appMode === 'desktop' ||
    String(process.env.DESKTOP_MODE ?? '').toLowerCase() === 'true';
  return {
    nodeEnv,
    appMode: appMode || (desktopMode ? 'desktop' : 'web'),
    desktopMode,
    isProduction: nodeEnv === 'production',
    port: Number.parseInt(process.env.PORT ?? '3000', 10),
    /**
     * In desktop mode we bind to 127.0.0.1 only (no LAN exposure). Web SaaS
     * deployments keep the original 0.0.0.0 default so reverse proxies work.
     */
    host: process.env.HOST?.trim() || (desktopMode ? '127.0.0.1' : '0.0.0.0'),
    /** Comma-separated origins, or `*` (development only — blocked in production by Joi). */
    corsOrigin: (process.env.CORS_ORIGIN ?? '*').trim() || '*',
  };
});
