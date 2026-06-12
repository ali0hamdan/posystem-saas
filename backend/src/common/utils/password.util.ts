import { BadRequestException } from '@nestjs/common';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export function assertStrongPassword(password: string): void {
  if (password.length < 8 || password.length > 128 || !PASSWORD_PATTERN.test(password)) {
    throw new BadRequestException({
      message: 'Password must be 8–128 characters and include uppercase, lowercase, and a number',
      code: 'WEAK_PASSWORD',
    });
  }
}
