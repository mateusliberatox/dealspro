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

      // Busca discord_user_id antes de atualizar
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
          plan_expires_at:        null,
        })
        .eq('user_id', userId);

      // Adiciona cargo premium no Discord (silencioso se não configurado ou user não está no server)
      if (existing?.discord_user_id) {
        await addPremiumRole(existing.discord_user_id).catch(() => {});
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

      // Remove cargo premium e desativa alertas
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

    case 'customer.subscription.updated': {
      const sub        = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const active     = sub.status === 'active' || sub.status === 'trialing';

      const { data: profile } = await supabaseAdmin
        .from('dealspro_profiles')
        .select('discord_user_id')
        .eq('stripe_customer_id', customerId)
        .single();

      await supabaseAdmin
        .from('dealspro_profiles')
        .update({ plan: active ? 'premium' : 'free' })
        .eq('stripe_customer_id', customerId);

      // Sincroniza cargo Discord com status da assinatura
      if (profile?.discord_user_id) {
        if (active) await addPremiumRole(profile.discord_user_id).catch(() => {});
        else        await removePremiumRole(profile.discord_user_id).catch(() => {});
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
