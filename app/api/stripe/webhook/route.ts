import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe';
import { addPremiumRole, removePremiumRole } from '@/lib/discord';
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

      // Busca current_period_end da subscription para salvar plan_expires_at
      // SDK v22: current_period_end está em items.data[0], não no topo
      let planExpiresAt: string | null = null;
      if (session.subscription) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const sub = await stripe.subscriptions.retrieve(session.subscription as string) as any;
          const ts: number | undefined =
            sub.current_period_end ?? sub.items?.data?.[0]?.current_period_end;
          if (ts) planExpiresAt = new Date(ts * 1000).toISOString();
        } catch (err) {
          console.warn('[Stripe] subscription.retrieve falhou — plan_expires_at ficará null:', err);
        }
      }

      const { data: existing } = await supabaseAdmin
        .from('dealspro_profiles')
        .select('discord_user_id')
        .eq('user_id', userId)
        .single();

      await supabaseAdmin
        .from('dealspro_profiles')
        .update({
          plan:                   'premium',
          stripe_customer_id:     session.customer as string,
          stripe_subscription_id: session.subscription as string,
          plan_expires_at:        planExpiresAt,
        })
        .eq('user_id', userId);

      if (existing?.discord_user_id) {
        await addPremiumRole(existing.discord_user_id).catch(() => {});
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
        if (active) await addPremiumRole(profile.discord_user_id).catch(() => {});
        else        await removePremiumRole(profile.discord_user_id).catch(() => {});
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
        await removePremiumRole(profile.discord_user_id).catch(() => {});
      }
      if (profile?.user_id) {
        await supabaseAdmin
          .from('user_alerts_dealspro')
          .update({ is_active: false })
          .eq('user_id', profile.user_id);
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
