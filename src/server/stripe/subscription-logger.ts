import { config } from '@/server/config';

type LogPayload = Record<string, unknown>;

const SENSITIVE_KEYS = new Set([
  'rawBody',
  'signature',
  'customerEmail',
  'customerPhone',
  'paymentMethod',
  'clientSecret',
]);

function sanitize(value: unknown, key?: string): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (key && SENSITIVE_KEYS.has(key)) return `[redacted:${value.length}]`;
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (Array.isArray(value)) return value.map((entry) => sanitize(entry));
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[entryKey] = sanitize(entryValue, entryKey);
    }
    return result;
  }
  return value;
}

export function logStripeSubscriptionEvent(event: string, payload?: LogPayload) {
  if (!config.STRIPE_SUBSCRIPTION_LOGS_ENABLED) return;

  const timestamp = new Date().toISOString();
  if (payload) {
     
    console.info(`[stripe-subscription] ${event}`, sanitize({ timestamp, ...payload }));
    return;
  }
   
  console.info(`[stripe-subscription] ${event}`, { timestamp });
}
