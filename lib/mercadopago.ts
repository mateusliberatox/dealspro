const BASE = 'https://api.mercadopago.com';
const token = () => process.env.MERCADOPAGO_ACCESS_TOKEN!;

export async function createPixPayment(opts: { amount: number; email: string; userId: string }) {
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
  const res = await fetch(`${BASE}/v1/payments`, {
    method: 'POST',
    headers: {
      Authorization:       `Bearer ${token()}`,
      'Content-Type':      'application/json',
      'X-Idempotency-Key': `${opts.userId}-${Date.now()}`,
    },
    body: JSON.stringify({
      transaction_amount: opts.amount,
      description:        'DealsPro Premium — 30 dias',
      payment_method_id:  'pix',
      payer:              { email: opts.email },
      metadata:           { user_id: opts.userId },
      date_of_expiration: expiresAt,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Mercado Pago: ${JSON.stringify(err)}`);
  }
  return res.json();
}

export async function getPayment(id: string) {
  const res = await fetch(`${BASE}/v1/payments/${id}`, {
    headers: { Authorization: `Bearer ${token()}` },
    cache:   'no-store',
  });
  if (!res.ok) throw new Error('Falha ao buscar pagamento');
  return res.json();
}
