import { getPayment } from '@/lib/mercadopago';
import { addPremiumRole } from '@/lib/discord';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  // MP envia action='payment.updated' ou type='payment'
  const paymentId = body.data?.id;
  if (!paymentId) return NextResponse.json({ ok: true });
  if (body.action !== 'payment.updated' && body.type !== 'payment') {
    return NextResponse.json({ ok: true });
  }

  const payment = await getPayment(String(paymentId)).catch(() => null);
  if (!payment || payment.status !== 'approved') return NextResponse.json({ ok: true });

  const userId = payment.metadata?.user_id as string | undefined;
  if (!userId) return NextResponse.json({ ok: true });

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: existing } = await supabaseAdmin
    .from('dealspro_profiles')
    .select('discord_user_id, referred_by, is_admin, plan')
    .eq('user_id', userId)
    .single();

  // Idempotência: ignora se já é premium com expiração futura via MP
  if (existing?.plan === 'premium') {
    console.log(`[MP] Pagamento duplicado ignorado para ${userId}`);
    return NextResponse.json({ ok: true });
  }

  await supabaseAdmin
    .from('dealspro_profiles')
    .update({ plan: 'premium', plan_expires_at: planExpiresAt })
    .eq('user_id', userId);

  if (existing?.discord_user_id) {
    await addPremiumRole(existing.discord_user_id).catch(() => {});
  }

  // Bônus de indicação
  if (existing?.referred_by && !existing?.is_admin) {
    const { data: referrer } = await supabaseAdmin
      .from('dealspro_profiles')
      .select('user_id, plan, plan_expires_at, is_admin')
      .eq('referral_code', existing.referred_by)
      .single();

    if (referrer && !referrer.is_admin) {
      const base = referrer.plan_expires_at && new Date(referrer.plan_expires_at) > new Date()
        ? new Date(referrer.plan_expires_at)
        : new Date();
      base.setDate(base.getDate() + 30);
      await supabaseAdmin
        .from('dealspro_profiles')
        .update({ plan: 'premium', plan_expires_at: base.toISOString() })
        .eq('user_id', referrer.user_id);
      console.log(`[MP Referral] +30 dias para ${referrer.user_id} (indicou ${userId})`);
    }
  }

  console.log(`[MP] Premium concedido para ${userId} — expira ${planExpiresAt}`);
  return NextResponse.json({ ok: true });
}
