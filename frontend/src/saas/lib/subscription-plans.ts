import type { LicensePlanCode, SaasPlan } from '@/saas/types';

export type SubscriptionPlanOption = {
  code: LicensePlanCode;
  label: string;
  termDays: number;
};

/** Default SaaS subscription offerings (maps to Plan.code in the database). */
export const SUBSCRIPTION_PLAN_OPTIONS: SubscriptionPlanOption[] = [
  { code: 'STARTER', label: '6 months', termDays: 180 },
  { code: 'PRO', label: '1 year', termDays: 365 },
];

export function resolveSubscriptionPlanOptions(apiPlans?: SaasPlan[]): SubscriptionPlanOption[] {
  if (!apiPlans?.length) {
    return SUBSCRIPTION_PLAN_OPTIONS;
  }

  const opts: SubscriptionPlanOption[] = [];
  const starter = apiPlans.find((p) => p.code === 'STARTER');
  const yearly = apiPlans.find((p) => p.code === 'PRO');

  if (starter) {
    opts.push({
      code: 'STARTER',
      label: starter.name,
      termDays: 180,
    });
  }
  if (yearly) {
    opts.push({
      code: 'PRO',
      label: yearly.name,
      termDays: 365,
    });
  }

  return opts.length > 0 ? opts : SUBSCRIPTION_PLAN_OPTIONS;
}

export function termDaysForPlanCode(
  code: LicensePlanCode,
  options: SubscriptionPlanOption[] = SUBSCRIPTION_PLAN_OPTIONS,
): number {
  return options.find((p) => p.code === code)?.termDays ?? 365;
}
