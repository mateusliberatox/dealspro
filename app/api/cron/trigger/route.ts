import { timingSafeEqual } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { expireOverduePlans } from '@/lib/plan';
import { processRoleSyncQueue } from '@/lib/discord';
import { log } from '@/lib/log';

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(provided: string | null): boolean {
  if (!provided || !CRON_SECRET) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(CRON_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * POST /api/cron/trigger
 * Called by cron-job.org every 3-5 minutes.
 * Handles plan expiry, Discord role sync, and scraper health checks.
 * Scraping is now handled by Railway (persistent server) — GitHub Actions
 * workflow_dispatch kept only for manual fallback.
 *
 * Requires headers:
 *   x-cron-secret: <CRON_SECRET env var>
 */
export async function POST(request: NextRequest) {
  // Auth check
  const secret = request.headers.get('x-cron-secret');
  if (!verifyCronSecret(secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Expira planos vencidos (PIX e trials sem stripe_subscription_id).
  // Lógica centralizada em lib/plan.ts, usada também no render do feed.
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const expiredCount = await expireOverduePlans(db);
    if (expiredCount > 0) log.info('cron_expired_plans', { count: expiredCount });

    // Processa fila de retries do Discord (cargos que falharam ao adicionar/remover)
    const roleSync = await processRoleSyncQueue(db);
    if (roleSync.done + roleSync.failed + roleSync.retried > 0) {
      log.info('cron_discord_role_sync', roleSync);
    }

    // Health check: alerta no Discord se scraper parou de detectar produtos
    // Usa janelas fixas (30-32, 60-62, 120-122 min) para alertar uma vez por período
    // sem precisar de estado externo.
    const { data: lastProd } = await db
      .from('produtos_dealspro')
      .select('criado_em')
      .order('criado_em', { ascending: false })
      .limit(1)
      .single();

    if (lastProd) {
      const gapMin = (Date.now() - new Date(lastProd.criado_em).getTime()) / 60_000;
      const shouldAlert = [30, 60, 120].some((t) => gapMin >= t && gapMin < t + 2);
      // Usa DISCORD_ADMIN_WEBHOOK_URL (canal privado do admin) — nunca o canal público
      const adminWebhook = process.env.DISCORD_ADMIN_WEBHOOK_URL;
      if (shouldAlert && adminWebhook) {
        await fetch(adminWebhook, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            content: `⚠️ **DealsPro — Scraper parado há ${Math.round(gapMin)} minutos!** Verificar Railway.`,
          }),
        }).catch(() => {});
        log.warn('scraper_health_alert', { gapMin: Math.round(gapMin) });
      }
    }
  } catch (e) {
    log.warn('cron_expire_error', { error: e instanceof Error ? e.message : String(e) });
  }

  return NextResponse.json({ ok: true, triggered_at: new Date().toISOString() });
}
