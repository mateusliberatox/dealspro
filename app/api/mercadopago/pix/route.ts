import { createPixPayment, getPayment, grantPremiumFromMPPayment } from '@/lib/mercadopago';
import { createClient } from '@/lib/supabase/server';
import { log } from '@/lib/log';
import { NextRequest, NextResponse } from 'next/server';

const PIX_AMOUNT = 9.99;

// POST — cria um pagamento PIX e retorna QR code
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  if (profile?.plan === 'premium') {
    return NextResponse.json({ error: 'Você já é premium' }, { status: 400 });
  }

  try {
    const payment = await createPixPayment({ amount: PIX_AMOUNT, email: user.email!, userId: user.id });
    const qr      = payment.point_of_interaction?.transaction_data;

    return NextResponse.json({
      payment_id:     String(payment.id),
      qr_code_base64: qr?.qr_code_base64 ?? null,
      qr_code:        qr?.qr_code ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log.error('mp_pix_create_failed', { error: msg, userId: user.id });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// GET ?id=<payment_id> — verifica status (polling do cliente)
// Quando aprovado, também promove o usuário a Premium como fallback caso o webhook do MP falhe.
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const payment = await getPayment(id).catch(() => null);
  if (!payment) return NextResponse.json({ status: 'error' });

  const status = payment.status as string;

  // Fallback: webhook pode falhar (signature, secret ausente, URL não cadastrada).
  // grantPremiumFromMPPayment é idempotente — seguro chamar a cada poll.
  if (status === 'approved') {
    const r = await grantPremiumFromMPPayment(id).catch((e) => {
      log.error('mp_polling_grant_error', { paymentId: id, error: e instanceof Error ? e.message : String(e) });
      return null;
    });
    if (r && !r.ok) log.warn('mp_polling_grant_skip', { paymentId: id, reason: r.reason });
  }

  return NextResponse.json({ status });
}
