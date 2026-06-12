/**
 * Bug 2 — payment-simulation gate.
 *
 * Verifies that `PublicService.simulatePaymentSuccess` is gated by the
 * explicit env flag ENABLE_PAYMENT_SIMULATION and NOT by NODE_ENV.
 *
 * Staging environments are NOT production-NODE_ENV but they must still
 * refuse the simulate-success call. These tests fail if anyone reverts to
 * the old `if (NODE_ENV === 'production')` gate.
 */

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed'),
  compare: jest.fn(),
}));

import { BadRequestException } from '@nestjs/common';
import { PublicService } from '../public/public.service';

function makePublicService() {
  // The simulation gate fires before any other dependency is touched, so
  // empty stubs are fine for the gate tests.
  const prisma = {
    paymentRecord: { findUnique: jest.fn() },
    plan: { findUnique: jest.fn() },
    client: { findFirst: jest.fn() },
    otpCode: { findFirst: jest.fn() },
    $transaction: jest.fn(),
  };
  const audit = { log: jest.fn() };
  const otp = { generate: jest.fn(), verify: jest.fn() };
  const notifications = { sendEmail: jest.fn() };
  return new PublicService(prisma as never, audit as never, otp as never, notifications as never);
}

describe('PublicService.simulatePaymentSuccess gate', () => {
  const ORIGINAL_ENV = process.env.ENABLE_PAYMENT_SIMULATION;
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.ENABLE_PAYMENT_SIMULATION = ORIGINAL_ENV;
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });

  it('refuses with PAYMENT_SIMULATION_DISABLED when env flag is missing', async () => {
    delete process.env.ENABLE_PAYMENT_SIMULATION;
    process.env.NODE_ENV = 'development';
    const svc = makePublicService();
    await expect(svc.simulatePaymentSuccess('pay-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PAYMENT_SIMULATION_DISABLED' }),
    });
  });

  it('refuses with PAYMENT_SIMULATION_DISABLED when env flag is "false"', async () => {
    process.env.ENABLE_PAYMENT_SIMULATION = 'false';
    process.env.NODE_ENV = 'development';
    const svc = makePublicService();
    await expect(svc.simulatePaymentSuccess('pay-1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses on staging-like envs (NODE_ENV !== production but flag unset)', async () => {
    // The exact bug we are fixing: prior gate said "if NODE_ENV === 'production' block".
    // Staging is NOT production, so the OLD gate would have *allowed* the call.
    delete process.env.ENABLE_PAYMENT_SIMULATION;
    process.env.NODE_ENV = 'staging';
    const svc = makePublicService();
    await expect(svc.simulatePaymentSuccess('pay-1')).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PAYMENT_SIMULATION_DISABLED' }),
    });
  });

  it('passes the gate when ENABLE_PAYMENT_SIMULATION=true (then fails downstream for unknown id)', async () => {
    process.env.ENABLE_PAYMENT_SIMULATION = 'true';
    process.env.NODE_ENV = 'development';
    const svc = makePublicService();
    // Past the gate → tries to look up the payment record → not-found path.
    // We assert the error is NOT the gate error: the gate let us through.
    await expect(svc.simulatePaymentSuccess('pay-missing')).rejects.not.toMatchObject({
      response: expect.objectContaining({ code: 'PAYMENT_SIMULATION_DISABLED' }),
    });
  });

  it('accepts =1 and =yes as truthy variants', async () => {
    for (const variant of ['1', 'yes', 'TRUE', 'True']) {
      process.env.ENABLE_PAYMENT_SIMULATION = variant;
      process.env.NODE_ENV = 'development';
      const svc = makePublicService();
      await expect(svc.simulatePaymentSuccess('pay-x')).rejects.not.toMatchObject({
        response: expect.objectContaining({ code: 'PAYMENT_SIMULATION_DISABLED' }),
      });
    }
  });
});
