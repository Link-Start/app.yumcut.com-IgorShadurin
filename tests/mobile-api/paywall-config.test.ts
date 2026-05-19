import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';

import { SUBSCRIPTION_PLAN_ORDER, getSubscriptionPlanByKey } from '@/shared/constants/subscriptions';

const route = await import('@/app/api/mobile/paywall-config/route');

describe('GET /api/mobile/paywall-config', () => {
  it('returns public plan max values without auth', async () => {
    const res = route.GET(new NextRequest('http://localhost/api/mobile/paywall-config'));

    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('public');

    const payload = await res.json();
    expect(payload.plans).toEqual(
      SUBSCRIPTION_PLAN_ORDER.map((planKey) => {
        const plan = getSubscriptionPlanByKey(planKey);
        return {
          planKey: plan.planKey,
          productId: plan.productId,
          interval: plan.interval,
          tokens: plan.tokens,
          maxValues: plan.maxValues,
        };
      }),
    );
    expect(payload.plans.map((plan: any) => [plan.planKey, plan.maxValues.videos])).toEqual([
      ['weekly', 1],
      ['monthly', 10],
      ['monthly_pro', 20],
    ]);
  });
});
