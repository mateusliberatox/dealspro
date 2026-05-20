import type { SupabaseClient } from '@supabase/supabase-js';
import { log } from '@/lib/log';

/**
 * Decide o plano efetivo de um perfil considerando expiração.
 * Centraliza a regra antes espalhada em app/page.tsx e app/api/cron/trigger/route.ts.
 *
 * Regra de expira:
 *   Premium sem Stripe subscription ativa + plan_expires_at no passado → volta para free.
 *   (Stripe subscriptions são geridas pelos webhooks subscription.updated/deleted.)
 */
type ProfileSlice = {
  plan: 'free' | 'premium';
  plan_expires_at: string | null;
  stripe_subscription_id: string | null;
};

export function effectivePlan(profile: ProfileSlice | null | undefined, now: Date = new Date()): 'free' | 'premium' {
  if (!profile) return 'free';
  if (profile.plan !== 'premium') return profile.plan;

  // Premium com Stripe ativo: confia no webhook
  if (profile.stripe_subscription_id) return 'premium';

  // Premium sem Stripe (PIX/trial/grant manual): respeita plan_expires_at
  if (profile.plan_expires_at && new Date(profile.plan_expires_at) < now) {
    return 'free';
  }
  return 'premium';
}

/**
 * Reverte para `free` todos os perfis premium-sem-Stripe com expiração no passado.
 * Idempotente e seguro de chamar várias vezes (apenas afeta linhas que ainda não foram revertidas).
 *
 * Chamado pelo cron a cada ciclo. NÃO afeta `produtos_dealspro` nem
 * `notification_logs` — não dispara nem republica nada.
 */
export async function expireOverduePlans(db: SupabaseClient): Promise<number> {
  const { data, error } = await db
    .from('dealspro_profiles')
    .update({ plan: 'free' })
    .eq('plan', 'premium')
    .is('stripe_subscription_id', null)
    .lt('plan_expires_at', new Date().toISOString())
    .not('plan_expires_at', 'is', null)
    .select('user_id');

  if (error) {
    log.warn('expire_plans_error', { error: error.message });
    return 0;
  }

  const expired = data ?? [];
  if (expired.length > 0) {
    const expiredIds = expired.map((p) => p.user_id);
    const { error: alertError } = await db
      .from('user_alerts_dealspro')
      .update({ is_active: false })
      .in('user_id', expiredIds);
    if (alertError) log.warn('expire_alerts_error', { error: alertError.message });
  }

  return expired.length;
}
