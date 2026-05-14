import { grantPremiumFromMPPayment, revokePremiumFromMPPayment, getPayment } from '@/lib/mercadopago';
import { log } from '@/lib/log';
import { createHmac } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

function validateSignature(request: NextRequest): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;
  if (!secret) {
    log.warn('mp_webhook_no_secret', {});
    return true;
  }

  const xSignature = request.headers.get('x-signature');
  const xRequestId = request.headers.get('x-request-id');
  if (!xSignature || !xRequestId) return false;

  const parts = Object.fromEntries(
    xSignature.split(',').map((p) => { const [k, v] = p.split('='); return [k, v]; }),
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return false;

  // MP usa o data.id da QUERY STRING (não do body) e exige `;` no final do manifesto
  const dataId = request.nextUrl.searchParams.get('data.id');
  if (!dataId) return false;

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const hmac     = createHmac('sha256', secret).update(manifest).digest('hex');
  return hmac === v1;
}

export async function POST(request: NextRequest) {
  if (!validateSignature(request)) {
    log.error('mp_webhook_invalid_signature', {});
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: true });

  // paymentId vem da QUERY STRING — mesma fonte que a assinatura cobre.
  // Body como fallback só quando não há secret (modo de dev/preview).
  const queryId  = request.nextUrl.searchParams.get('data.id');
  const hasSecret = !!process.env.MERCADOPAGO_WEBHOOK_SECRET;
  const paymentId = queryId ?? (hasSecret ? null : body.data?.id);

  if (!paymentId) return NextResponse.json({ ok: true });
  if (body.action !== 'payment.updated' && body.type !== 'payment') {
    return NextResponse.json({ ok: true });
  }

  // Consulta o status uma vez para rotear: aprovado → grant, refunded/cancelled → revoke.
  const payment = await getPayment(String(paymentId)).catch(() => null);
  const status  = payment?.status as string | undefined;

  if (status === 'approved') {
    const r = await grantPremiumFromMPPayment(String(paymentId));
    if (!r.ok) log.warn('mp_webhook_grant_skip', { paymentId, reason: r.reason });
  } else if (status === 'refunded' || status === 'cancelled') {
    const r = await revokePremiumFromMPPayment(String(paymentId), status);
    if (!r.ok) log.warn('mp_webhook_revoke_skip', { paymentId, reason: r.reason });
  }

  return NextResponse.json({ ok: true });
}
