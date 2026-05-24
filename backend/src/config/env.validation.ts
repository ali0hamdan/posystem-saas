import * as Joi from 'joi';
import { hasLicenseSigningKeyPair } from '../license/license-keys.util';

const DEV_PLACEHOLDER_JWT = '0123456789abcdef0123456789abcdef';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  DATABASE_URL: Joi.string().required(),
  CORS_ORIGIN: Joi.string()
    .trim()
    .allow('')
    .default('*')
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string()
        .min(8)
        .invalid('*')
        .required()
        .messages({
          'any.invalid':
            'CORS_ORIGIN cannot be "*" in production. Set a comma-separated list of allowed web origins (e.g. https://app.example.com).',
        }),
      otherwise: Joi.string(),
    }),
  JWT_SECRET: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string()
        .min(48)
        .invalid(DEV_PLACEHOLDER_JWT)
        .required()
        .messages({
          'any.invalid':
            'JWT_SECRET must not use the development placeholder value. Generate a strong secret (e.g. openssl rand -base64 48).',
        }),
      otherwise: Joi.string().min(32).required(),
    }),
  JWT_EXPIRES_IN: Joi.string().default('8h'),
  SAAS_JWT_SECRET: Joi.string()
    .trim()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.string().min(48).required().messages({
        'any.required':
          'SAAS_JWT_SECRET is required in production (separate from JWT_SECRET; used only for SaaS admin API tokens).',
      }),
      otherwise: Joi.string().min(32).default('0123456789abcdef0123456789abcdef0123456789ab'),
    }),
  SAAS_JWT_EXPIRES_IN: Joi.string().default('12h'),
  /** If set with SAAS_ADMIN_PASSWORD, `prisma db seed` upserts a SUPER_ADMIN SaaS operator. */
  SAAS_ADMIN_EMAIL: Joi.string().trim().email().allow('').optional(),
  SAAS_ADMIN_PASSWORD: Joi.string().allow('').optional(),
  THROTTLE_TTL_MS: Joi.number().integer().min(1000).max(3_600_000).optional(),
  THROTTLE_LIMIT: Joi.number().integer().min(1).max(1_000_000).optional(),
  TRUST_PROXY: Joi.string().valid('0', '1', 'true', 'false', 'yes', 'no', '').optional(),
  BYPASS_LICENSE: Joi.boolean().truthy('true', '1', 'yes').falsy('false', '0', 'no').default(false),
  LICENSE_RSA_PRIVATE_KEY_B64: Joi.string().trim().allow('').optional(),
  LICENSE_RSA_PUBLIC_KEY_B64: Joi.string().trim().allow('').optional(),
  LICENSE_VALIDATION_CACHE_MS: Joi.number().integer().min(1000).max(600_000).optional(),
  SENTRY_DSN: Joi.string().trim().max(512).allow('').optional(),
  LOG_LEVEL: Joi.string()
    .valid('fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent')
    .optional(),
})
  .custom((value, helpers) => {
    const v = value as Record<string, unknown>;
    const bypass = Boolean(v.BYPASS_LICENSE);
    const nodeEnv = String(v.NODE_ENV ?? 'development');
    const priv = String(v.LICENSE_RSA_PRIVATE_KEY_B64 ?? '').trim();
    const pub = String(v.LICENSE_RSA_PUBLIC_KEY_B64 ?? '').trim();

    if (!bypass) {
      if (nodeEnv === 'production') {
        if (!hasLicenseSigningKeyPair(priv, pub)) {
          return helpers.error('any.custom', {
            message:
              'In production with BYPASS_LICENSE=false, LICENSE_RSA_PRIVATE_KEY_B64 and LICENSE_RSA_PUBLIC_KEY_B64 are required (valid base64-encoded PEM). Generate offline; do not use JWT_SECRET.',
          });
        }
      } else if ((priv && !pub) || (!priv && pub)) {
        return helpers.error('any.custom', {
          message:
            'Set both LICENSE_RSA_PRIVATE_KEY_B64 and LICENSE_RSA_PUBLIC_KEY_B64, or leave both unset and run: npm run license:keys',
        });
      } else if (priv && pub && !hasLicenseSigningKeyPair(priv, pub)) {
        return helpers.error('any.custom', {
          message:
            'LICENSE_RSA_*_B64 values must be valid base64-encoded PEM key files. Run: npm run license:keys',
        });
      }
    }
    return value;
  });
