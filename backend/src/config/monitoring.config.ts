import { registerAs } from '@nestjs/config';

export default registerAs('monitoring', () => ({
  sentryDsn: (process.env.SENTRY_DSN ?? '').trim() || null,
  logLevel: (process.env.LOG_LEVEL ?? '').trim() || null,
}));
