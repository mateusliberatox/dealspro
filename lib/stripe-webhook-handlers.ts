import type { SupabaseClient } from '@supabase/supabase-js';
import type Stripe from 'stripe';
import { log } from '@/lib/log';

export interface StripeHandlerDeps {
  db: SupabaseClient;
  addPremiumRole: (discordId: string) => Promise<unknown>;
  removePremiumRole: (discordId: string) => Promise<unknown>;
  retrieveSubscription: (id: string) => Promise<Stripe.Subscription>;
}

export async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  deps: StripeHandlerDeps,
): Promise<void> {
  const userId = session.client_reference_id ?? session.metadata?.user_id;
  if (!userId) return;

  const isPix = session.mode === 'payment' && session.metadata?.payment_type === 'pix';

  let planExpiresAt: string | null = null;
  let subscriptionId: string | null = null;

  if (isPix) {
    planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (session.subscription) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sub = await deps.retrieveSubscription(session.subscription as string) as any;
      const ts: number | undefined =
        sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
      planExpiresAt = ts
        ? new Date(ts * 1000).toISOString()
        : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
      subscriptionId = session.subscription as string;
    } catch (err) {
      log.warn('stripe_subscription_retrieve_fallback', { error: err instanceof Error ? err.message : String(err) });
      planExpiresAt  = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
      subscriptionId = session.subscription as string;
    }
  }

  const { data: existing } = await deps.db
    .from('dealspro_profiles')
    .select('discord_user_id, referred_by, is_admin, stripe_customer_id')
    .eq('user_id', userId)
    .single();

  await deps.db
    .from('dealspro_profiles')
    .update({
      plan:                   'premium',
      stripe_customer_id:     session.customer as string,
      stripe_subscription_id: subscriptionId,
      plan_expires_at:        planExpiresAt,
    })
    .eq('user_id', userId);

  if (existing?.discord_user_id) {
    await deps.addPremiumRole(existing.discord_user_id);
  }

  // Recompensa de indicação: 1 mês grátis para quem indicou.
  // Só na PRIMEIRA compra (stripe_customer_id ainda nulo) — garante idempotência.
  const isFirstPurchase = !existing?.stripe_customer_id;
  if (existing?.referred_by && !existing?.is_admin && isFirstPurchase) {
    const { data: referrer } = await deps.db
      .from('dealspro_profiles')
      .select('user_id, plan, plan_expires_at, stripe_subscription_id, is_admin')
      .eq('referral_code', existing.referred_by)
      .single();

    if (referrer && !referrer.is_admin) {
      const base = referrer.plan_expires_at && new Date(referrer.plan_expires_at) > new Date()
        ? new Date(referrer.plan_expires_at)
        : new Date();
      base.setDate(base.getDate() + 30);
      await deps.db
        .from('dealspro_profiles')
        .update({ plan: 'premium', plan_expires_at: base.toISOString() })
        .eq('user_id', referrer.user_id);
      log.info('stripe_referral_bonus', { referrer: referrer.user_id, referred: userId });
    }
  }
}

export async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
  deps: StripeHandlerDeps,
): Promise<void> {
  const customerId = sub.customer as string;
  const active     = sub.status === 'active' || sub.status === 'trialing';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subAny     = sub as any;
  const periodEnd: number | undefined =
    subAny.current_period_end ?? subAny.items?.data?.[0]?.current_period_end;
  const planExpiresAt = active && periodEnd
    ? new Date(periodEnd * 1000).toISOString()
    : null;

  const { data: profile } = await deps.db
    .from('dealspro_profiles')
    .select('discord_user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  await deps.db
    .from('dealspro_profiles')
    .update({ plan: active ? 'premium' : 'free', plan_expires_at: planExpiresAt })
    .eq('stripe_customer_id', customerId);

  if (profile?.discord_user_id) {
    if (active) await deps.addPremiumRole(profile.discord_user_id);
    else        await deps.removePremiumRole(profile.discord_user_id);
  }
}

export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  deps: StripeHandlerDeps,
): Promise<void> {
  const customerId = sub.customer as string;
  const expiresAt  = sub.canceled_at
    ? new Date(sub.canceled_at * 1000).toISOString()
    : new Date().toISOString();

  const { data: profile } = await deps.db
    .from('dealspro_profiles')
    .select('user_id, discord_user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  await deps.db
    .from('dealspro_profiles')
    .update({ plan: 'free', stripe_subscription_id: null, plan_expires_at: expiresAt })
    .eq('stripe_customer_id', customerId);

  if (profile?.discord_user_id) {
    await deps.removePremiumRole(profile.discord_user_id);
  }
  if (profile?.user_id) {
    await deps.db
      .from('user_alerts_dealspro')
      .update({ is_active: false })
      .eq('user_id', profile.user_id);
  }
  log.info('stripe_subscription_deleted', { customerId, userId: profile?.user_id });
}

export async function handleChargeRefunded(
  charge: Stripe.Charge,
  deps: StripeHandlerDeps,
): Promise<void> {
  const customerId = (charge.customer as string | null) ?? undefined;
  if (!customerId) {
    log.warn('stripe_refund_no_customer', { chargeId: charge.id });
    return;
  }

  // Ignora reembolso parcial — só age quando 100% do valor foi devolvido
  if (charge.amount_refunded < charge.amount) {
    log.info('stripe_refund_partial_ignored', {
      chargeId:       charge.id,
      amountRefunded: charge.amount_refunded,
      amountTotal:    charge.amount,
    });
    return;
  }

  const { data: profile } = await deps.db
    .from('dealspro_profiles')
    .select('user_id, discord_user_id')
    .eq('stripe_customer_id', customerId)
    .single();

  if (!profile) {
    log.warn('stripe_refund_no_profile', { customerId });
    return;
  }

  const now = new Date().toISOString();
  await deps.db
    .from('dealspro_profiles')
    .update({ plan: 'free', plan_expires_at: now })
    .eq('user_id', profile.user_id);

  await deps.db
    .from('user_alerts_dealspro')
    .update({ is_active: false })
    .eq('user_id', profile.user_id);

  if (profile.discord_user_id) {
    await deps.removePremiumRole(profile.discord_user_id);
  }

  log.info('stripe_refund_processed', {
    chargeId: charge.id,
    userId:   profile.user_id,
    amount:   charge.amount_refunded,
  });
}
