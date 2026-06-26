export class AccountDeletionBlockedByStripeError extends Error {
  readonly status = 409;
  readonly code = 'STRIPE_SUBSCRIPTION_CANCEL_REQUIRED';
  readonly details: {
    subscriptionId?: string | null;
    portalUrl?: string | null;
  };

  constructor(input: {
    message: string;
    subscriptionId?: string | null;
    portalUrl?: string | null;
  }) {
    super(input.message);
    this.name = 'AccountDeletionBlockedByStripeError';
    this.details = {
      subscriptionId: input.subscriptionId ?? null,
      portalUrl: input.portalUrl ?? null,
    };
  }
}
