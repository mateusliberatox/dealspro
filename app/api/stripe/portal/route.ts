import { stripe } from '@/lib/stripe';
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    return NextResponse.json({ error: 'Nenhuma assinatura encontrada' }, { status: 400 });
  }

  const origin = request.headers.get('origin') ?? 'https://dealspro-chi.vercel.app';

  const session = await stripe.billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${origin}/minha-conta`,
  });

  return NextResponse.json({ url: session.url });
}
