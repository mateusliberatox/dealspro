import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const origin = request.headers.get('origin') ?? 'https://dealspro-chi.vercel.app';

  // Check if user already has a Stripe customer
  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('stripe_customer_id, plan')
    .eq('user_id', user.id)
    .single();

  if (profile?.plan === 'premium') {
    return NextResponse.json({ error: 'Você já é premium' }, { status: 400 });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    client_reference_id: user.id,
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id ? undefined : user.email,
    success_url: `${origin}/upgrade/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/upgrade/cancelado`,
    metadata: { user_id: user.id },
    subscription_data: {
      metadata: { user_id: user.id },
    },
  });

  return NextResponse.json({ url: session.url });
}
