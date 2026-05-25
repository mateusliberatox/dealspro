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

const TOKEN                  = process.env.TELEGRAM_BOT_TOKEN;
const MODES                  = ['all_deals', 'both'];
const SLEEP                  = (ms) => new Promise((r) => setTimeout(r, ms));
const RATE_DELAY             = 350; // delay entre PRODUTOS (não entre usuários)
const FREE_NOTIFY_BATCH_SIZE = parseInt(process.env.FREE_NOTIFY_BATCH_SIZE ?? '50', 10);

function isValidImageUrl(url) {
  if (!url || url.includes(' ')) return false;
  try {
    const { protocol } = new URL(url);
    return (protocol === 'http:' || protocol === 'https:') &&
      !/placeholder|800.?x.?900|via\.placeholder|picsum|skin\/img\/product\/\d+/i.test(url);
  } catch { return false; }
}

function buildMessage(product) {
  const nome = product.nome_traduzido || product.nome;
  const cat  = product.categoria ? `📂 <b>${product.categoria}</b>\n` : '';
  return (
    `🛍️ <b>Novo deal!</b>\n\n` +
    cat +
    `📦 ${nome}\n` +
    `💰 <b>${product.preco || 'Ver no site'}</b>\n\n` +
    `<a href="${product.link}">👉 Abrir no CSSDeals</a>`
  );
}

async function sendMsg(chatId, text, imageUrl = null) {
  if (!TOKEN) return false;
  const opts = { signal: AbortSignal.timeout(10_000) };
  if (imageUrl) {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: text, parse_mode: 'HTML' }),
      ...opts,
    }).catch(() => ({ ok: false }));
    if (res.ok) return true;
  }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    ...opts,
  }).catch(() => ({ ok: false }));
  return res.ok;
}

/**
 * Pré-carrega notification_logs em uma query para evitar N+1 por (usuário × produto).
 * Retorna um Set de chaves "userId:itemId" ou "userId:pidProductId".
 */
async function buildSentSet(userIds, products, channel) {
  const itemIds    = products.map((p) => p.cssdeals_item_id).filter(Boolean);
  const productIds = products.map((p) => p.id).filter(Boolean);

  const conditions = [];
  if (itemIds.length)    conditions.push(`cssdeals_item_id.in.(${itemIds.join(',')})`);
  if (productIds.length) conditions.push(`product_id.in.(${productIds.join(',')})`);
  if (!conditions.length || !userIds.length) return new Set();

  const { data: logs } = await supabase
    .from('notification_logs')
    .select('user_id, product_id, cssdeals_item_id')
    .in('user_id', userIds)
    .eq('channel', channel)
    .or(conditions.join(','));

  const set = new Set();
  for (const l of logs ?? []) {
    if (l.cssdeals_item_id) set.add(`${l.user_id}:${l.cssdeals_item_id}`);
    if (l.product_id)       set.add(`${l.user_id}:pid${l.product_id}`);
  }
  return set;
}

function sentKey(userId, product) {
  return product.cssdeals_item_id
    ? `${userId}:${product.cssdeals_item_id}`
    : `${userId}:pid${product.id}`;
}

/**
 * Envia produtos para todos os usuários elegíveis em paralelo.
 * Delay de RATE_DELAY ms entre produtos (não entre usuários).
 */
async function dispatchFeed(users, products, channel) {
  if (!users.length || !products.length) return 0;

  const userIds = users.map((u) => u.user_id);
  const sentSet = await buildSentSet(userIds, products, channel);
  const logsToInsert = [];
  let sent = 0;

  for (let i = 0; i < products.length; i++) {
    const product  = products[i];
    const text     = buildMessage(product);
    const imageUrl = isValidImageUrl(product.imagem) ? product.imagem : null;
    const eligible = users.filter((u) => !sentSet.has(sentKey(u.user_id, product)));

    if (eligible.length) {
      await Promise.allSettled(
        eligible.map(async (user) => {
          const ok = await sendMsg(user.telegram_chat_id, text, imageUrl);
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

export async function notifyTelegramPremiumFeed(products) {
  if (!TOKEN || !products.length) return;

  const { data: users } = await supabase
    .from('dealspro_profiles')
    .select('user_id, telegram_chat_id')
    .eq('plan', 'premium')
    .in('telegram_notify_mode', MODES)
    .not('telegram_chat_id', 'is', null);

  if (!users?.length) return;

  const sent = await dispatchFeed(users, products, 'telegram_feed');
  if (sent > 0) logger.success(`Telegram premium feed: ${sent} mensagem(ns) enviada(s)`);
}

// ── Free: envia quando visible_at passou ─────────────────────────────────────

export async function notifyTelegramFreeFeed() {
  if (!TOKEN) return;

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

  const sent = await dispatchFeed(users, products, 'telegram_feed');
  if (sent > 0) logger.success(`Telegram free feed: ${sent} mensagem(ns) enviada(s)`);
}
