import { createPixPayment, getPayment } from '@/lib/mercadopago';
import { createClient } from '@/lib/supabase/server';
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

  const payment = await createPixPayment({ amount: PIX_AMOUNT, email: user.email!, userId: user.id });
  const qr      = payment.point_of_interaction?.transaction_data;

  return NextResponse.json({
    payment_id:     String(payment.id),
    qr_code_base64: qr?.qr_code_base64 ?? null,
    qr_code:        qr?.qr_code ?? null,
  });
}

// GET ?id=<payment_id> — verifica status (polling do cliente)
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const payment = await getPayment(id).catch(() => null);
  if (!payment) return NextResponse.json({ status: 'error' });

  return NextResponse.json({ status: payment.status as string });
}
