import { stripe, STRIPE_PRICE_ID, STRIPE_ANNUAL_PRICE_ID, STRIPE_FIRST_MONTH_COUPON } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/site';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  // plan: 'monthly' | 'annual' — padrão mensal
  const body  = await request.json().catch(() => ({})) as { plan?: string };
  const plan  = body.plan === 'annual' ? 'annual' : 'monthly';
  const priceId = plan === 'annual' ? STRIPE_ANNUAL_PRICE_ID : STRIPE_PRICE_ID;

  if (!priceId) {
    return NextResponse.json({ error: 'Plano não configurado' }, { status: 500 });
  }

  const origin = request.headers.get('origin') ?? SITE_URL;

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('stripe_customer_id, plan')
    .eq('user_id', user.id)
    .single();

  if (profile?.plan === 'premium') {
    return NextResponse.json({ error: 'Você já é premium' }, { status: 400 });
  }

  // Cupom de primeiro mês só para plano mensal (anual já tem desconto embutido)
  const applyCoupon =
    plan === 'monthly' &&
    !!STRIPE_FIRST_MONTH_COUPON &&
    !profile?.stripe_customer_id;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id ? undefined : user.email,
    success_url: `${origin}/upgrade/sucesso?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/upgrade/cancelado`,
    metadata: { user_id: user.id, plan },
    subscription_data: { metadata: { user_id: user.id } },
    ...(applyCoupon ? { discounts: [{ coupon: STRIPE_FIRST_MONTH_COUPON! }] } : {}),
  });

  return NextResponse.json({ url: session.url });
}
