import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe';
import { addPremiumRole, removePremiumRole } from '@/lib/discord';
import { log } from '@/lib/log';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const body      = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId  = session.client_reference_id ?? session.metadata?.user_id;
      if (!userId) break;

      const isPix = session.mode === 'payment' && session.metadata?.payment_type === 'pix';

      let planExpiresAt: string | null = null;
      let subscriptionId: string | null = null;

      if (isPix) {
        // PIX: pagamento único de 30 dias
        planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      } else if (session.subscription) {
        // Cartão: busca current_period_end da subscription
        // SDK v22: current_period_end está em items.data[0], não no topo
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sub = await stripe.subscriptions.retrieve(session.subscription as string) as any;
          const ts: number | undefined =
            sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
          planExpiresAt = ts
            ? new Date(ts * 1000).toISOString()
            : new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString(); // fallback +31 dias
          subscriptionId = session.subscription as string;
        } catch (err) {
          log.warn('stripe_subscription_retrieve_fallback', { error: err instanceof Error ? err.message : String(err) });
          planExpiresAt = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
          subscriptionId = session.subscription as string;
        }
      }

      const { data: existing } = await supabaseAdmin
        .from('dealspro_profiles')
        .select('discord_user_id, referred_by, is_admin, stripe_customer_id')
        .eq('user_id', userId)
        .single();

      await supabaseAdmin
        .from('dealspro_profiles')
        .update({
          plan:                   'premium',
          stripe_customer_id:     session.customer as string,
          stripe_subscription_id: subscriptionId,
          plan_expires_at:        planExpiresAt,
        })
        .eq('user_id', userId);

      if (existing?.discord_user_id) {
        await addPremiumRole(existing.discord_user_id);
      }

      // Recompensa de indicação: 1 mês grátis para quem indicou.
      // Condições: usuário tem referred_by, não é admin, e é a PRIMEIRA compra
      // (stripe_customer_id ainda nulo = nunca teve transação Stripe antes).
      // Isso garante idempotência — re-assinaturas não recompensam o indicador novamente.
      const isFirstPurchase = !existing?.stripe_customer_id;
      if (existing?.referred_by && !existing?.is_admin && isFirstPurchase) {
        const { data: referrer } = await supabaseAdmin
          .from('dealspro_profiles')
          .select('user_id, plan, plan_expires_at, stripe_subscription_id, is_admin')
          .eq('referral_code', existing.referred_by)
          .single();

        // Não recompensa admin nem a si mesmo
        if (referrer && !referrer.is_admin) {
          const base = referrer.plan_expires_at && new Date(referrer.plan_expires_at) > new Date()
            ? new Date(referrer.plan_expires_at)
            : new Date();
          base.setDate(base.getDate() + 30);
          await supabaseAdmin
            .from('dealspro_profiles')
            .update({ plan: 'premium', plan_expires_at: base.toISOString() })
            .eq('user_id', referrer.user_id);
          log.info('stripe_referral_bonus', { referrer: referrer.user_id, referred: userId });
        }
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub        = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const active     = sub.status === 'active' || sub.status === 'trialing';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const subAny     = sub as any;
      // SDK v22: current_period_end pode estar em items.data[0]
      const periodEnd: number | undefined =
        subAny.current_period_end ?? subAny.items?.data?.[0]?.current_period_end;
      const planExpiresAt = active && periodEnd
        ? new Date(periodEnd * 1000).toISOString()
        : null;

      const { data: profile } = await supabaseAdmin
        .from('dealspro_profiles')
        .select('discord_user_id')
        .eq('stripe_customer_id', customerId)
        .single();

      await supabaseAdmin
        .from('dealspro_profiles')
        .update({ plan: active ? 'premium' : 'free', plan_expires_at: planExpiresAt })
        .eq('stripe_customer_id', customerId);

      if (profile?.discord_user_id) {
        if (active) await addPremiumRole(profile.discord_user_id);
        else        await removePremiumRole(profile.discord_user_id);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub        = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const expiresAt  = sub.canceled_at
        ? new Date(sub.canceled_at * 1000).toISOString()
        : new Date().toISOString();

      const { data: profile } = await supabaseAdmin
        .from('dealspro_profiles')
        .select('user_id, discord_user_id')
        .eq('stripe_customer_id', customerId)
        .single();

      await supabaseAdmin
        .from('dealspro_profiles')
        .update({ plan: 'free', stripe_subscription_id: null, plan_expires_at: expiresAt })
        .eq('stripe_customer_id', customerId);

      if (profile?.discord_user_id) {
        await removePremiumRole(profile.discord_user_id);
      }
      if (profile?.user_id) {
        await supabaseAdmin
          .from('user_alerts_dealspro')
          .update({ is_active: false })
          .eq('user_id', profile.user_id);
      }
      log.info('stripe_subscription_deleted', { customerId, userId: profile?.user_id });
      break;
    }

    // Reembolso: revoga premium apenas em reembolso TOTAL.
    // Reembolsos parciais (ex: disputa de $1) não cortam o acesso do usuário.
    case 'charge.refunded': {
      const charge     = event.data.object as Stripe.Charge;
      const customerId = (charge.customer as string | null) ?? undefined;
      if (!customerId) {
        log.warn('stripe_refund_no_customer', { chargeId: charge.id });
        break;
      }

      // Ignora reembolso parcial — só age quando 100% do valor foi devolvido
      if (charge.amount_refunded < charge.amount) {
        log.info('stripe_refund_partial_ignored', {
          chargeId:        charge.id,
          amountRefunded:  charge.amount_refunded,
          amountTotal:     charge.amount,
        });
        break;
      }

      const { data: profile } = await supabaseAdmin
        .from('dealspro_profiles')
        .select('user_id, discord_user_id')
        .eq('stripe_customer_id', customerId)
        .single();

      if (!profile) {
        log.warn('stripe_refund_no_profile', { customerId });
        break;
      }

      const now = new Date().toISOString();
      await supabaseAdmin
        .from('dealspro_profiles')
        .update({ plan: 'free', plan_expires_at: now })
        .eq('user_id', profile.user_id);

      await supabaseAdmin
        .from('user_alerts_dealspro')
        .update({ is_active: false })
        .eq('user_id', profile.user_id);

      if (profile.discord_user_id) {
        await removePremiumRole(profile.discord_user_id);
      }

      log.info('stripe_refund_processed', {
        chargeId: charge.id,
        userId:   profile.user_id,
        amount:   charge.amount_refunded,
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
