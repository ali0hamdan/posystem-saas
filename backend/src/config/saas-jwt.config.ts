import { registerAs } from '@nestjs/config';

export default registerAs('saasJwt', () => {
  const secret = (process.env.SAAS_JWT_SECRET ?? '').trim();
  if (process.env.NODE_ENV === 'production' && secret.length < 48) {
    throw new Error('SAAS_JWT_SECRET must be at least 48 characters in production');
  }
  return {
    secret,
    expiresIn: process.env.SAAS_JWT_EXPIRES_IN ?? '12h',
  };
});
