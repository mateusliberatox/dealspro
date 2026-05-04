import { stripe, STRIPE_WEBHOOK_SECRET } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';

// Service-role client — bypasses RLS for webhook updates
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: NextRequest) {
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

      await supabaseAdmin
        .from('dealspro_profiles')
        .update({
          plan:                   'premium',
          stripe_customer_id:     session.customer as string,
          stripe_subscription_id: session.subscription as string,
          plan_expires_at:        null, // active subscription — no expiry
        })
        .eq('user_id', userId);
      break;
    }

    case 'customer.subscription.deleted': {
      const sub        = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;

      await supabaseAdmin
        .from('dealspro_profiles')
        .update({ plan: 'free', stripe_subscription_id: null })
        .eq('stripe_customer_id', customerId);
      break;
    }

    case 'customer.subscription.updated': {
      const sub        = event.data.object as Stripe.Subscription;
      const customerId = sub.customer as string;
      const active     = sub.status === 'active' || sub.status === 'trialing';

      await supabaseAdmin
        .from('dealspro_profiles')
        .update({ plan: active ? 'premium' : 'free' })
        .eq('stripe_customer_id', customerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
