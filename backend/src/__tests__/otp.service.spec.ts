jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('hashed-otp'),
}));

import { UnauthorizedException } from '@nestjs/common';
import { compare, hash } from 'bcrypt';
import { OtpPurpose } from '@prisma/client';
import { OtpService } from '../otp/otp.service';
import { EmailDeliveryError } from '../email/email.service';

const compareMock = compare as unknown as jest.Mock;
const hashMock = hash as unknown as jest.Mock;

function makeService() {
  const prisma: {
    otpCode: {
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  } = {
    otpCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
  };
  const email = {
    sendOtpEmail: jest.fn().mockResolvedValue(undefined),
  };
  const service = new OtpService(prisma as never, email as never);
  return { service, prisma, email };
}

beforeEach(() => {
  compareMock.mockReset();
  hashMock.mockResolvedValue('hashed-otp');
});

describe('OtpService', () => {
  it('generateOtp returns a 6-digit string', () => {
    const { service } = makeService();
    const code = service.generateOtp();
    expect(code).toMatch(/^\d{6}$/);
  });

  it('createOtp stores hashed code and sends email', async () => {
    const { service, prisma, email } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(null);
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpCode.create.mockResolvedValue({ id: 'otp-1' });

    await service.createOtp({
      email: 'Owner@Example.com',
      purpose: OtpPurpose.EMAIL_VERIFICATION,
      userId: 'u1',
      clientId: 'c1',
    });

    expect(hashMock).toHaveBeenCalled();
    expect(prisma.otpCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'owner@example.com',
          codeHash: 'hashed-otp',
          purpose: OtpPurpose.EMAIL_VERIFICATION,
        }),
      }),
    );
    expect(email.sendOtpEmail).toHaveBeenCalledWith(
      'owner@example.com',
      expect.stringMatching(/^\d{6}$/),
      OtpPurpose.EMAIL_VERIFICATION,
    );
  });

  it('verifyOtp rejects invalid codes', async () => {
    const { service, prisma } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue({
      id: 'otp-1',
      codeHash: 'hashed-otp',
      expiresAt: new Date(Date.now() + 60_000),
      attempts: 0,
      maxAttempts: 5,
      userId: 'u1',
      clientId: 'c1',
    });
    compareMock.mockResolvedValue(false);
    prisma.otpCode.update.mockResolvedValue({});

    await expect(
      service.verifyOtp({
        email: 'owner@example.com',
        purpose: OtpPurpose.EMAIL_VERIFICATION,
        code: '000000',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('createOtp rolls back when email delivery fails', async () => {
    const { service, prisma, email } = makeService();
    prisma.otpCode.findFirst.mockResolvedValue(null);
    prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
    prisma.otpCode.create.mockResolvedValue({ id: 'otp-1' });
    email.sendOtpEmail.mockRejectedValue(new EmailDeliveryError());

    await expect(
      service.createOtp({
        email: 'owner@example.com',
        purpose: OtpPurpose.PASSWORD_RESET,
      }),
    ).rejects.toMatchObject({ response: { code: 'EMAIL_SEND_FAILED' } });

    expect(prisma.otpCode.updateMany).toHaveBeenCalledTimes(2);
  });
});
