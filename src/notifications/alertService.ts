import { supabase } from '../database/supabase.js';
import { sendDiscordDM } from './discord.js';
import { logger } from '../utils/logger.js';
import { productMatchesAlert } from '../utils/alertMatch.js';
import { sendTelegramMsg } from '../utils/telegram.js';
import type { Product, Alert, Profile } from '../types.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type ProductRow = Product & { id?: string | number };

interface AlertRow extends Alert {
  user_id: string;
}

interface ProfileRow extends Profile {
  user_id: string;
}

interface DispatchDMArgs {
  alert:       AlertRow;
  product:     ProductRow;
  discordId:   string | null | undefined;
  telegramId:  number | null | undefined;
  isRestock:   boolean;
  notifiedSet: Set<string>;
}

/**
 * Para cada produto novo, encontra alertas ativos de usuários premium que coincidem
 * e despacha DM via Discord e/ou Telegram.
 */
export async function matchAndNotify(
  products: ProductRow[],
  { isRestock = false } = {},
): Promise<void> {
  if (!products.length) return;

  const { data: alerts, error: alertsError } = await supabase
    .from('user_alerts_dealspro')
    .select('id, user_id, keyword, size, categoria')
    .eq('is_active', true);

  if (alertsError) { logger.error(`Alert fetch failed: ${alertsError.message}`); return; }
  if (!alerts?.length) return;

  const userIds = [...new Set((alerts as AlertRow[]).map((a) => a.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('dealspro_profiles')
    .select('user_id, plan, discord_user_id, telegram_chat_id')
    .in('user_id', userIds)
    .eq('plan', 'premium');

  if (profilesError) { logger.error(`Profile fetch failed: ${profilesError.message}`); return; }
  if (!profiles?.length) return;

  const profileMap    = new Map((profiles as ProfileRow[]).map((p) => [p.user_id, p]));
  const premiumAlerts = (alerts as AlertRow[]).filter((a) => profileMap.has(a.user_id));
  if (!premiumAlerts.length) return;

  // Pré-busca todos os logs relevantes em UMA query para evitar N+1
  const notifiedSet = new Set<string>();
  if (!isRestock) {
    const itemIds        = products.map((p) => p.cssdeals_item_id).filter(Boolean);
    const productIds     = products.map((p) => p.id).filter(Boolean);
    const premiumUserIds = [...new Set(premiumAlerts.map((a) => a.user_id))];

    const conditions: string[] = [];
    if (itemIds.length)    conditions.push(`cssdeals_item_id.in.(${itemIds.join(',')})`);
    if (productIds.length) conditions.push(`product_id.in.(${productIds.join(',')})`);

    if (conditions.length && premiumUserIds.length) {
      const { data: logs } = await supabase
        .from('notification_logs')
        .select('user_id, product_id, cssdeals_item_id')
        .in('user_id', premiumUserIds)
        .in('channel', ['discord_dm', 'telegram_dm'])
        .or(conditions.join(','));

      for (const l of (logs ?? []) as Array<{ user_id: string; product_id?: string | number; cssdeals_item_id?: string | null }>) {
        if (l.cssdeals_item_id) notifiedSet.add(`${l.user_id}:${l.cssdeals_item_id}`);
        if (l.product_id)       notifiedSet.add(`${l.user_id}:pid${l.product_id}`);
      }
    }
  }

  for (const product of products) {
    for (const alert of premiumAlerts) {
      if (!productMatchesAlert(product, alert)) continue;

      const prof       = profileMap.get(alert.user_id);
      const discordId  = prof?.discord_user_id;
      const telegramId = prof?.telegram_chat_id;

      await dispatchDM({ alert, product, discordId, telegramId, isRestock, notifiedSet });
    }
  }
}

async function dispatchDM({ alert, product, discordId, telegramId, isRestock = false, notifiedSet }: DispatchDMArgs): Promise<void> {
  const nome   = product.nome_traduzido || product.nome;
  const itemId = product.cssdeals_item_id ?? null;

  // Deduplicação via Set pré-carregado (evita query por par produto×usuário)
  if (!isRestock) {
    const seenByItem = itemId      && notifiedSet.has(`${alert.user_id}:${itemId}`);
    const seenByPid  = !itemId     && product.id && notifiedSet.has(`${alert.user_id}:pid${product.id}`);
    if (seenByItem || seenByPid) {
      logger.info(`DM dedup: ${alert.user_id} × ${itemId ?? product.id}`);
      return;
    }
    if (itemId)     notifiedSet.add(`${alert.user_id}:${itemId}`);
    if (product.id) notifiedSet.add(`${alert.user_id}:pid${product.id}`);
  }

  // Discord DM
  if (discordId) {
    try {
      await sendDiscordDM(discordId, product, isRestock);
      await logNotification({
        user_id:          alert.user_id,
        product_id:       product.id,
        cssdeals_item_id: itemId,
        alert_id:         alert.id,
        channel:          'discord_dm',
        status:           'sent',
      });
      logger.success(`Discord DM → ${alert.user_id} — "${nome}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await logNotification({
        user_id:          alert.user_id,
        product_id:       product.id,
        cssdeals_item_id: itemId,
        alert_id:         alert.id,
        channel:          'discord_dm',
        status:           'failed',
        error:            msg,
      });
      logger.error(`Discord DM falhou: ${msg}`);
    }
    await sleep(500);
  }

  // Telegram DM
  if (telegramId) {
    const icon     = isRestock ? '🔄' : '🔔';
    const label    = isRestock ? 'Produto restocado!' : 'Novo produto encontrado!';
    const cat      = product.categoria ? `📂 <b>${product.categoria}</b>\n` : '';
    const text     =
      `${icon} <b>${label}</b>\n\n` +
      cat +
      `📦 ${nome}\n` +
      `💰 <b>${product.preco || 'Ver no site'}</b>\n\n` +
      `<a href="${product.link}">👉 Abrir no CSSDeals</a>`;
    const imageUrl = product.imagem || null;

    try {
      const ok = await sendTelegramMsg(telegramId, text, imageUrl);
      if (ok) {
        await logNotification({
          user_id:          alert.user_id,
          product_id:       product.id,
          cssdeals_item_id: itemId,
          alert_id:         alert.id,
          channel:          'telegram_dm',
          status:           'sent',
        });
        logger.success(`Telegram DM → ${alert.user_id} — "${nome}"`);
      } else {
        throw new Error('sendTelegramMsg returned false');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      // Enfileira para retry pelo cron em vez de perder silenciosamente
      const { error: enqueueErr } = await supabase.from('telegram_notify_queue').insert({
        user_id:          alert.user_id,
        telegram_chat_id: telegramId,
        product_id:       product.id ?? null,
        cssdeals_item_id: itemId ?? null,
        alert_id:         alert.id ?? null,
        message_text:     text,
        image_url:        imageUrl,
        last_error:       msg,
        next_retry_at:    new Date(Date.now() + 5 * 60_000).toISOString(),
      });
      if (enqueueErr) logger.error(`Telegram enqueue failed: ${enqueueErr.message}`);

      await logNotification({
        user_id:          alert.user_id,
        product_id:       product.id,
        cssdeals_item_id: itemId,
        alert_id:         alert.id,
        channel:          'telegram_dm',
        status:           'failed',
        error:            msg,
      });
      logger.error(`Telegram DM falhou (enfileirado para retry): ${msg}`);
    }
    await sleep(500);
  }

  if (!discordId && !telegramId) {
    await logNotification({
      user_id:          alert.user_id,
      product_id:       product.id,
      cssdeals_item_id: itemId,
      alert_id:         alert.id,
      channel:          'discord_dm',
      status:           'failed',
      error:            'no_channel_configured',
    });
  }
}

async function logNotification(entry: Record<string, unknown>): Promise<void> {
  const { error } = await supabase.from('notification_logs').insert(entry);
  if (error) logger.error(`Failed to log notification: ${error.message}`);
}
