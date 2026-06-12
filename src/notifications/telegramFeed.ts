/**
 * Envia o feed de deals via Telegram respeitando o plano do usuário.
 * Premium → imediato. Free → após visible_at (30 min).
 *
 * Envios são paralelizados POR USUÁRIO para cada produto:
 *   antes: users × products × 350ms = lento demais em lotes grandes
 *   agora: products × 350ms (todos os usuários recebem em paralelo)
 */

import { supabase } from '../database/supabase.js';
import { logger } from '../utils/logger.js';
import { isValidImageUrl } from '../utils/discordEmbed.js';
import { buildTelegramMessage } from '../utils/telegramMessage.js';
import { sendTelegramMsg } from '../utils/telegram.js';
import type { Product } from '../types.js';

interface TelegramUser { user_id: string; telegram_chat_id: number }

const MODES                  = ['all_deals', 'both'];
const SLEEP                  = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RATE_DELAY             = 350;
const FREE_NOTIFY_BATCH_SIZE = parseInt(process.env.FREE_NOTIFY_BATCH_SIZE ?? '50', 10);

// Telegram limita a ~30 msg/s por bot globalmente.
// Enviamos usuários em batches de 10 com 400ms de pausa entre batches → ≤25 msg/s.
const USER_BATCH_SIZE  = 10;
const USER_BATCH_DELAY = 400;

/**
 * Pré-carrega notification_logs em uma query para evitar N+1 por (usuário × produto).
 */
async function buildSentSet(userIds: string[], products: Product[], channel: string): Promise<Set<string>> {
  const itemIds    = products.map((p) => p.cssdeals_item_id).filter(Boolean);
  const productIds = products.map((p) => p.id).filter(Boolean);

  const conditions: string[] = [];
  if (itemIds.length)    conditions.push(`cssdeals_item_id.in.(${itemIds.join(',')})`);
  if (productIds.length) conditions.push(`product_id.in.(${productIds.join(',')})`);
  if (!conditions.length || !userIds.length) return new Set();

  const { data: logs } = await supabase
    .from('notification_logs')
    .select('user_id, product_id, cssdeals_item_id')
    .in('user_id', userIds)
    .eq('channel', channel)
    .or(conditions.join(','));

  const set = new Set<string>();
  for (const l of (logs ?? []) as Array<{ user_id: string; product_id?: string | number; cssdeals_item_id?: string | null }>) {
    if (l.cssdeals_item_id) set.add(`${l.user_id}:${l.cssdeals_item_id}`);
    if (l.product_id)       set.add(`${l.user_id}:pid${l.product_id}`);
  }
  return set;
}

function sentKey(userId: string, product: Product): string {
  return product.cssdeals_item_id
    ? `${userId}:${product.cssdeals_item_id}`
    : `${userId}:pid${product.id}`;
}

async function dispatchFeed(users: TelegramUser[], products: Product[], channel: string, { isRestock = false } = {}): Promise<number> {
  if (!users.length || !products.length) return 0;

  const userIds = users.map((u) => u.user_id);
  const sentSet = await buildSentSet(userIds, products, channel);
  const logsToInsert: Record<string, unknown>[] = [];
  let sent = 0;

  for (let i = 0; i < products.length; i++) {
    const product  = products[i];
    const text     = buildTelegramMessage(product, { isRestock });
    const imageUrl = isValidImageUrl(product.imagem) ? product.imagem : null;
    const eligible = users.filter((u) => !sentSet.has(sentKey(u.user_id, product)));

    for (let b = 0; b < eligible.length; b += USER_BATCH_SIZE) {
      const userBatch = eligible.slice(b, b + USER_BATCH_SIZE);
      await Promise.allSettled(
        userBatch.map(async (user) => {
          const ok = await sendTelegramMsg(user.telegram_chat_id, text, imageUrl ?? null);
          if (ok) {
            sentSet.add(sentKey(user.user_id, product));
            logsToInsert.push({
              user_id:          user.user_id,
              product_id:       product.id,
              cssdeals_item_id: product.cssdeals_item_id ?? null,
              channel,
              status:           'sent',
            });
            sent++;
          }
        }),
      );
      if (b + USER_BATCH_SIZE < eligible.length) await SLEEP(USER_BATCH_DELAY);
    }

    if (i < products.length - 1) await SLEEP(RATE_DELAY);
  }

  if (logsToInsert.length) {
    const { error: logErr } = await supabase.from('notification_logs').insert(logsToInsert);
    if (logErr) logger.error(`logSent batch [${channel}] falhou: ${logErr.message}`);
  }

  return sent;
}

// ── Premium: envia imediatamente ─────────────────────────────────────────────

export async function notifyTelegramPremiumFeed(products: Product[]): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !products.length) return;

  const { data: users } = await supabase
    .from('dealspro_profiles')
    .select('user_id, telegram_chat_id')
    .eq('plan', 'premium')
    .in('telegram_notify_mode', MODES)
    .not('telegram_chat_id', 'is', null);

  if (!users?.length) return;

  const sent = await dispatchFeed(users as TelegramUser[], products, 'telegram_feed');
  if (sent > 0) logger.success(`Telegram premium feed: ${sent} mensagem(ns) enviada(s)`);
}

// ── Restock: anuncia para premium e free de uma vez ──────────────────────────

export async function notifyTelegramRestock(products: Product[]): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN || !products.length) return;

  const { data: users } = await supabase
    .from('dealspro_profiles')
    .select('user_id, telegram_chat_id')
    .in('telegram_notify_mode', MODES)
    .not('telegram_chat_id', 'is', null);

  if (!users?.length) return;

  const sent = await dispatchFeed(users as TelegramUser[], products, 'telegram_restock', { isRestock: true });
  if (sent > 0) logger.success(`Telegram restock feed: ${sent} mensagem(ns) enviada(s)`);
}

// ── Free: envia quando visible_at passou ─────────────────────────────────────

export async function notifyTelegramFreeFeed(): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;

  const { data: users } = await supabase
    .from('dealspro_profiles')
    .select('user_id, telegram_chat_id')
    .eq('plan', 'free')
    .in('telegram_notify_mode', MODES)
    .not('telegram_chat_id', 'is', null);

  if (!users?.length) return;

  const now    = new Date().toISOString();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: products } = await supabase
    .from('produtos_dealspro')
    .select('*')
    .lte('visible_at', now)
    .gte('criado_em', cutoff)
    .eq('disponivel', true)
    .order('criado_em', { ascending: true })
    .limit(FREE_NOTIFY_BATCH_SIZE);

  if (!products?.length) return;

  const sent = await dispatchFeed(users as TelegramUser[], products as Product[], 'telegram_feed');
  if (sent > 0) logger.success(`Telegram free feed: ${sent} mensagem(ns) enviada(s)`);
}
