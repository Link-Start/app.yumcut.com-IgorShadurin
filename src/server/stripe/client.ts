import Stripe from 'stripe';
import { config } from '@/server/config';

let stripeClient: Stripe | null = null;

function hasConfigValue(value: string | undefined | null) {
  return Boolean(value && value.trim().length > 0);
}

export function getStripeClient() {
  const secretKey = config.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error('Stripe is not configured: STRIPE_SECRET_KEY is missing.');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      typescript: true,
    });
  }

  return stripeClient;
}

export function isStripePricingConfigured() {
  return Boolean(
    hasConfigValue(config.STRIPE_SECRET_KEY) &&
      hasConfigValue(config.STRIPE_WEBHOOK_SECRET) &&
      hasConfigValue(config.STRIPE_WEEKLY_PRICE_ID) &&
      hasConfigValue(config.STRIPE_MONTHLY_PRICE_ID) &&
      hasConfigValue(config.STRIPE_MONTHLY_PRO_PRICE_ID) &&
      hasConfigValue(config.NEXTAUTH_URL),
  );
}
