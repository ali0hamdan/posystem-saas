import { registerAs } from '@nestjs/config';

export default registerAs('jwt', () => {
  const secret = (process.env.JWT_SECRET ?? '').trim();
  if (process.env.NODE_ENV === 'production' && secret.length < 48) {
    throw new Error('JWT_SECRET must be at least 48 characters in production');
  }
  return {
    secret,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  };
});
