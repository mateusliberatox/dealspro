import Stripe from 'stripe';

// Lazily instantiated so `next build` doesn't fail when env vars aren't present locally.
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  return _stripe;
}

// Proxy keeps the existing `stripe.X` call sites working unchanged.
export const stripe = new Proxy({} as Stripe, {
  get(_t, prop) {
    return (getStripe() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

export const STRIPE_PRICE_ID      = process.env.STRIPE_PRICE_ID!;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!;
