import { ok } from '@/server/http';
import { SUBSCRIPTION_PLAN_ORDER, getSubscriptionPlanByKey } from '@/shared/constants/subscriptions';
import type { MobilePaywallConfigDTO } from '@/shared/types';
import type { NextRequest } from 'next/server';

export function GET(_req?: NextRequest) {
  const payload: MobilePaywallConfigDTO = {
    plans: SUBSCRIPTION_PLAN_ORDER.map((planKey) => {
      const plan = getSubscriptionPlanByKey(planKey);
      return {
        planKey: plan.planKey,
        productId: plan.productId,
        interval: plan.interval,
        tokens: plan.tokens,
        maxValues: plan.maxValues,
      };
    }),
  };

  return ok(payload, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
    },
  });
}
