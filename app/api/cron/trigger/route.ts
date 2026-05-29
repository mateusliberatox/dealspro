import { timingSafeEqual } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { expireOverduePlans } from '@/lib/plan';
import { processRoleSyncQueue, sendBotDM } from '@/lib/discord';
import { sendTelegramMedia } from '@/lib/telegram';
import { getTrackingUpdates, STATUS_LABELS, STATUS_EMOJI, STATUS_COLOR, trackingConfigured } from '@/lib/tracking';
import { log } from '@/lib/log';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CRON_SECRET = process.env.CRON_SECRET;

function verifyCronSecret(provided: string | null): boolean {
  if (!provided || !CRON_SECRET) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(CRON_SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

// ── Rastreamento de encomendas ─────────────────────────────────────────────────

interface OrderRow {
  id: string; user_id: string; tracking_code: string;
  status: string; notified_status: string | null;
  description: string | null; carrier_code: number | null;
}

interface ProfileRow { discord_user_id: string | null; telegram_chat_id: number | null }

async function processTrackingUpdates(db: SupabaseClient): Promise<{ checked: number; updated: number; notified: number }> {
  if (!trackingConfigured()) return { checked: 0, updated: 0, notified: 0 };

  // Só verifica encomendas ativas que não foram checadas nos últimos 15 minutos
  const checkBefore = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: orders } = await db
    .from('user_orders')
    .select('id, user_id, tracking_code, status, notified_status, description, carrier_code')
    .not('status', 'in', '("delivered","failed","returned")')
    .or(`last_checked_at.is.null,last_checked_at.lt.${checkBefore}`)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(40);

  if (!orders?.length) return { checked: 0, updated: 0, notified: 0 };

  const rows    = orders as OrderRow[];
  const codes   = rows.map((o) => o.tracking_code);
  const updates = await getTrackingUpdates(codes);
  const now     = new Date().toISOString();

  let updated = 0, notified = 0;

  for (const info of updates) {
    const order = rows.find((o) => o.tracking_code === info.code);
    if (!order) continue;

    const statusChanged = info.status !== order.status;
    const shouldNotify  = statusChanged && info.status !== order.notified_status;

    await db.from('user_orders').update({
      status:          info.status,
      carrier_code:    info.carrier || order.carrier_code,
      last_event:      info.lastEvent,
      last_event_at:   info.lastAt,
      last_checked_at: now,
      ...(statusChanged ? { updated_at: now } : {}),
    }).eq('id', order.id);

    if (statusChanged) updated++;

    if (shouldNotify) {
      // Busca canais de notificação do usuário
      const { data: prof } = await db
        .from('dealspro_profiles')
        .select('discord_user_id, telegram_chat_id')
        .eq('user_id', order.user_id)
        .single();

      const profile = prof as ProfileRow | null;
      const title   = order.description ?? order.tracking_code;
      const embed   = {
        color:       STATUS_COLOR[info.status],
        title:       `${STATUS_EMOJI[info.status]} ${STATUS_LABELS[info.status]}`,
        description: `**${title}**`,
        fields: [
          { name: 'Código',         value: `\`${order.tracking_code}\``, inline: true },
          ...(info.lastEvent ? [{ name: 'Último evento', value: info.lastEvent, inline: false }] : []),
        ],
        footer:    { text: 'DealsPro · Rastreamento de encomendas' },
        timestamp: info.lastAt ?? new Date().toISOString(),
      };

      // Discord DM
      if (profile?.discord_user_id) {
        await sendBotDM(profile.discord_user_id, { embeds: [embed] }).catch(() => {});
      }

      // Telegram DM
      if (profile?.telegram_chat_id) {
        const text =
          `${STATUS_EMOJI[info.status]} *${STATUS_LABELS[info.status]}*\n\n` +
          `📦 ${title}\n\`${order.tracking_code}\`\n` +
          (info.lastEvent ? `\n_${info.lastEvent}_` : '');
        await sendTelegramMedia(profile.telegram_chat_id, text).catch(() => {});
      }

      await db.from('user_orders').update({ notified_status: info.status }).eq('id', order.id);
      notified++;
    }
  }

  return { checked: rows.length, updated, notified };
}

async function processTelegramQueue(db: SupabaseClient): Promise<{ sent: number; failed: number }> {
  const now = new Date().toISOString();
  const { data: items, error } = await db
    .from('telegram_notify_queue')
    .select('*')
    .lte('next_retry_at', now)
    .order('next_retry_at', { ascending: true })
    .limit(20);

  if (error || !items?.length) return { sent: 0, failed: 0 };

  let sent = 0, failed = 0;

  for (const item of items) {
    const ok = await sendTelegramMedia(item.telegram_chat_id, item.message_text, item.image_url ?? null);
    const newAttempts = item.attempts + 1;

    if (ok) {
      await db.from('telegram_notify_queue').delete().eq('id', item.id);
      sent++;
    } else if (newAttempts >= item.max_attempts) {
      await db.from('telegram_notify_queue')
        .update({ attempts: newAttempts, last_error: 'max_attempts_reached' })
        .eq('id', item.id);
      failed++;
    } else {
      // Backoff exponencial: 5 * 2^attempts minutos (5, 10, 20…)
      const delayMs = 5 * Math.pow(2, newAttempts) * 60_000;
      await db.from('telegram_notify_queue')
        .update({ attempts: newAttempts, next_retry_at: new Date(Date.now() + delayMs).toISOString() })
        .eq('id', item.id);
    }
  }

  return { sent, failed };
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
    const expiredCount = await expireOverduePlans(db);
    if (expiredCount > 0) log.info('cron_expired_plans', { count: expiredCount });

    // Processa fila de retries do Discord (cargos que falharam ao adicionar/remover)
    const roleSync = await processRoleSyncQueue(db);
    if (roleSync.done + roleSync.failed + roleSync.retried > 0) {
      log.info('cron_discord_role_sync', roleSync);
    }

    // Processa fila de retries de DMs Telegram (alertas que falharam no Railway)
    const tgQueue = await processTelegramQueue(db);
    if (tgQueue.sent + tgQueue.failed > 0) {
      log.info('cron_telegram_queue', tgQueue);
    }

    // Verifica status das encomendas ativas e notifica usuários por DM
    const tracking = await processTrackingUpdates(db);
    if (tracking.checked > 0) {
      log.info('cron_tracking', tracking);
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
