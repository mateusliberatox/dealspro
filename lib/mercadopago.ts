import { createClient } from '@supabase/supabase-js';
import { addPremiumRole, removePremiumRole } from '@/lib/discord';
import { log } from '@/lib/log';

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

type GrantResult =
  | { ok: true;  userId: string; reason: 'granted' | 'already-granted' }
  | { ok: false; reason: 'payment-not-found' | 'not-approved' | 'no-user-id' | 'profile-not-found' | 'db-error' };

/**
 * Promove o usuário a Premium a partir de um pagamento PIX aprovado no MP.
 *
 * Idempotência:
 *   1) INSERT em pix_payments com `payment_id` PRIMARY KEY — só uma chamada vence o conflito.
 *   2) UPDATE no perfil filtrado por `granted_at IS NULL` — fallback caso a tabela falhe.
 *
 * Chamado pelo webhook E pelo polling do cliente (fallback caso webhook falhe).
 */
export async function grantPremiumFromMPPayment(paymentId: string): Promise<GrantResult> {
  const payment = await getPayment(paymentId).catch(() => null);
  if (!payment) return { ok: false, reason: 'payment-not-found' };
  if (payment.status !== 'approved') return { ok: false, reason: 'not-approved' };

  const userId = payment.metadata?.user_id as string | undefined;
  if (!userId) return { ok: false, reason: 'no-user-id' };

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Idempotência rígida: tenta inserir o pagamento. Se já existe e já foi granted, sai.
  const grantedAt = new Date().toISOString();
  const { data: inserted, error: insertErr } = await db
    .from('pix_payments')
    .upsert(
      {
        payment_id: String(paymentId),
        user_id:    userId,
        amount:     payment.transaction_amount,
        status:     'approved',
        granted_at: grantedAt,
        raw:        payment,
      },
      { onConflict: 'payment_id', ignoreDuplicates: true },
    )
    .select('payment_id');

  if (insertErr) {
    log.error('mp_upsert_pix_failed', { paymentId, error: insertErr.message });
    return { ok: false, reason: 'db-error' };
  }

  // Já existia (outro caminho processou) → não promove de novo
  if (!inserted || inserted.length === 0) {
    return { ok: true, userId, reason: 'already-granted' };
  }

  const { data: existing } = await db
    .from('dealspro_profiles')
    .select('discord_user_id, referred_by, is_admin')
    .eq('user_id', userId)
    .single();

  if (!existing) return { ok: false, reason: 'profile-not-found' };

  const planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error: updErr } = await db
    .from('dealspro_profiles')
    .update({ plan: 'premium', plan_expires_at: planExpiresAt })
    .eq('user_id', userId);

  if (updErr) {
    log.error('mp_update_profile_failed', { userId, error: updErr.message });
    return { ok: false, reason: 'db-error' };
  }

  if (existing.discord_user_id) {
    await addPremiumRole(existing.discord_user_id);
  }

  // Bônus de indicação — só dispara para quem vence o upsert
  if (existing.referred_by && !existing.is_admin) {
    const { data: referrer } = await db
      .from('dealspro_profiles')
      .select('user_id, plan_expires_at, is_admin')
      .eq('referral_code', existing.referred_by)
      .single();

    if (referrer && !referrer.is_admin) {
      const base = referrer.plan_expires_at && new Date(referrer.plan_expires_at) > new Date()
        ? new Date(referrer.plan_expires_at)
        : new Date();
      base.setDate(base.getDate() + 30);
      await db
        .from('dealspro_profiles')
        .update({ plan: 'premium', plan_expires_at: base.toISOString() })
        .eq('user_id', referrer.user_id);
      log.info('mp_referral_bonus', { referrer: referrer.user_id, referred: userId });
    }
  }

  log.info('mp_premium_granted', { userId, paymentId, expiresAt: planExpiresAt });
  return { ok: true, userId, reason: 'granted' };
}

type RevokeResult =
  | { ok: true;  userId: string; reason: 'revoked' | 'already-revoked' | 'never-granted' }
  | { ok: false; reason: 'payment-not-found' | 'db-error' };

/**
 * Revoga premium após reembolso/cancelamento de um pagamento PIX.
 * Idempotente por flag `refunded_at`.
 */
export async function revokePremiumFromMPPayment(paymentId: string, newStatus: 'refunded' | 'cancelled'): Promise<RevokeResult> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: row, error: fetchErr } = await db
    .from('pix_payments')
    .select('user_id, granted_at, refunded_at')
    .eq('payment_id', String(paymentId))
    .single();

  if (fetchErr || !row) return { ok: false, reason: 'payment-not-found' };
  if (row.refunded_at)  return { ok: true, userId: row.user_id, reason: 'already-revoked' };

  const now = new Date().toISOString();
  await db
    .from('pix_payments')
    .update({ status: newStatus, refunded_at: now })
    .eq('payment_id', String(paymentId));

  // Se nunca foi granted, só atualiza o registro
  if (!row.granted_at) return { ok: true, userId: row.user_id, reason: 'never-granted' };

  // Revoga premium: vira free e expira imediatamente
  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('discord_user_id')
    .eq('user_id', row.user_id)
    .single();

  await db
    .from('dealspro_profiles')
    .update({ plan: 'free', plan_expires_at: now })
    .eq('user_id', row.user_id);

  if (profile?.discord_user_id) {
    await removePremiumRole(profile.discord_user_id);
  }

  log.info('mp_premium_revoked', { userId: row.user_id, paymentId, reason: newStatus });
  return { ok: true, userId: row.user_id, reason: 'revoked' };
}
