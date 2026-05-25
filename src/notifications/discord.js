import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { buildDiscordEmbed } from '../utils/discordEmbed.js';

const WEBHOOK_URL      = process.env.DISCORD_WEBHOOK_URL;
const FREE_WEBHOOK_URL = process.env.DISCORD_FREE_WEBHOOK_URL;
const BOT_TOKEN        = process.env.DISCORD_BOT_TOKEN;
const DISCORD_API      = 'https://discord.com/api/v10';

const BATCH_ANNOUNCE_THRESHOLD  = 8;
const FREE_NOTIFY_BATCH_SIZE    = parseInt(process.env.FREE_NOTIFY_BATCH_SIZE ?? '50', 10);

// Cliente Supabase compartilhado (lazy init)
let _db;
function getDb() {
  if (!_db) _db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return _db;
}

// ── Helpers de deduplicação ───────────────────────────────────────────────────

/**
 * Verifica se um produto já foi enviado num canal específico.
 * Checa por cssdeals_item_id (sobrevive deleção/reinserção) e, como fallback, por product_id.
 */
async function alreadySentToChannel(channel, productId, itemId) {
  const db = getDb();

  if (itemId) {
    const { data } = await db
      .from('notification_logs')
      .select('id')
      .eq('cssdeals_item_id', itemId)
      .eq('channel', channel)
      .limit(1);
    if ((data?.length ?? 0) > 0) return true;
  }

  if (productId) {
    const { data } = await db
      .from('notification_logs')
      .select('id')
      .eq('product_id', productId)
      .eq('channel', channel)
      .limit(1);
    if ((data?.length ?? 0) > 0) return true;
  }

  return false;
}

async function logSent(channel, productId, itemId) {
  const { error } = await getDb().from('notification_logs').insert({
    product_id:       productId ?? null,
    cssdeals_item_id: itemId    ?? null,
    channel,
    status: 'sent',
  });
  if (error) logger.error(`logSent [${channel}] falhou product=${productId}: ${error.message}`);
}

// ── Anúncio de lote grande ────────────────────────────────────────────────────

export async function announceNewBatch(count, categories) {
  if (!FREE_WEBHOOK_URL || count < BATCH_ANNOUNCE_THRESHOLD) return;

  const catList = [...new Set(categories.filter(Boolean))].slice(0, 5).join(', ');

  await postWebhook(FREE_WEBHOOK_URL, {
    embeds: [{
      color: 0x3b82f6,
      title: `🛍️ ${count} produtos novos acabaram de chegar!`,
      description:
        `Foram detectados **${count} deals novos** no CSSDeals agora.\n\n` +
        (catList ? `📂 Categorias: ${catList}\n\n` : '') +
        `⭐ Membros **Premium** já estão vendo — você terá acesso em **30 minutos**.\n\n` +
        `[Assinar Premium para ver agora](https://dealspro-chi.vercel.app/upgrade)`,
      footer: { text: 'DealsPro • cssdeals.com' },
      timestamp: new Date().toISOString(),
    }],
  }).catch(() => {});
  logger.success(`Announced batch of ${count} new products to free channel`);
}

// ── Webhook canal premium (imediato) ─────────────────────────────────────────

export async function sendToDiscord(products) {
  if (!WEBHOOK_URL || !products.length) return;

  const db = getDb();

  // Pré-busca logs de deduplicação em batch — evita 2N queries no loop
  const itemIds    = products.map((p) => p.cssdeals_item_id).filter(Boolean);
  const productIds = products.map((p) => p.id).filter(Boolean);
  const conditions = [];
  if (itemIds.length)    conditions.push(`cssdeals_item_id.in.(${itemIds.join(',')})`);
  if (productIds.length) conditions.push(`product_id.in.(${productIds.join(',')})`);

  const sentSet = new Set();
  if (conditions.length) {
    const { data: logs } = await db
      .from('notification_logs')
      .select('product_id, cssdeals_item_id')
      .eq('channel', 'discord_premium')
      .or(conditions.join(','));
    for (const l of logs ?? []) {
      if (l.cssdeals_item_id) sentSet.add(`item:${l.cssdeals_item_id}`);
      if (l.product_id)       sentSet.add(`pid:${l.product_id}`);
    }
  }

  let sent = 0;
  for (const product of products) {
    const itemId     = product.cssdeals_item_id ?? null;
    const alreadySent = (itemId && sentSet.has(`item:${itemId}`)) ||
                        (!itemId && sentSet.has(`pid:${product.id}`));

    if (alreadySent) {
      logger.info(`Discord premium: produto ${itemId ?? product.id} já enviado — ignorado`);
      continue;
    }

    try {
      await postWebhook(WEBHOOK_URL, {
        content: '🔥 **Novo produto detectado!**',
        embeds:  [buildDiscordEmbed(product)],
      });
      await logSent('discord_premium', product.id, itemId);
      sentSet.add(itemId ? `item:${itemId}` : `pid:${product.id}`);
      sent++;
    } catch (err) {
      logger.warn(`Premium webhook failed for ${product.id}: ${err.message}`);
    }

    if (products.length > 1) await sleep(500);
  }

  if (sent > 0) logger.success(`Discord webhook premium: ${sent}/${products.length} produto(s)`);
}

// ── Webhook canal free (retardado 30 min) ────────────────────────────────────

export async function sendFreeDelayedNotifications() {
  if (!FREE_WEBHOOK_URL) return;

  const db      = getDb();
  const cutoff  = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

  const { data: due } = await db
    .from('produtos_dealspro')
    .select('*')
    .lte('visible_at', new Date().toISOString())
    .gte('criado_em', cutoff)
    .eq('free_notified', false)
    .eq('disponivel', true)
    .order('criado_em', { ascending: true })
    .limit(FREE_NOTIFY_BATCH_SIZE);

  if (!due?.length) return;

  let sent = 0;
  for (const product of due) {
    const itemId = product.cssdeals_item_id ?? null;

    // Deduplicação: cssdeals_item_id sobrevive a deleção/reinserção
    if (await alreadySentToChannel('discord_free', product.id, itemId)) {
      await db.from('produtos_dealspro').update({ free_notified: true }).eq('id', product.id);
      continue;
    }

    let ok = false;
    try {
      await postWebhook(FREE_WEBHOOK_URL, {
        content: '⏰ **Novo produto disponível!**',
        embeds:  [buildDiscordEmbed(product)],
      });
      ok = true;
    } catch (err) {
      logger.error(`Free webhook failed for ${product.id}: ${err.message}`);
    }

    if (ok) {
      await db.from('produtos_dealspro').update({ free_notified: true }).eq('id', product.id);
      await logSent('discord_free', product.id, itemId);
      sent++;
    }

    await sleep(500);
  }

  if (sent > 0) logger.success(`Discord free: ${sent} notificação(ões) enviada(s)`);
}

// ── DM de alerta (premium) ───────────────────────────────────────────────────

export async function sendDiscordDM(discordUserId, product, isRestock = false) {
  if (!BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN not configured');

  const channelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method:  'POST',
    headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ recipient_id: discordUserId }),
    signal:  AbortSignal.timeout(10_000),
  });

  if (!channelRes.ok) {
    const err = await channelRes.text();
    throw new Error(`DM channel open failed (${channelRes.status}): ${err}`);
  }

  const { id: channelId } = await channelRes.json();

  const payload = JSON.stringify({
    content: isRestock
      ? '🔄 **Alerta DealsPro — produto restocado!**'
      : '🔔 **Alerta DealsPro — produto encontrado!**',
    embeds: [buildDiscordEmbed(product)],
  });

  // Retry uma vez em caso de rate limit (429) — retry_after vem na resposta
  for (let attempt = 1; attempt <= 2; attempt++) {
    const msgRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method:  'POST',
      headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body:    payload,
      signal:  AbortSignal.timeout(10_000),
    });

    if (msgRes.ok) return;

    if (msgRes.status === 429 && attempt < 2) {
      const body  = await msgRes.json().catch(() => ({}));
      const waitMs = Math.ceil((body.retry_after ?? 1) * 1000) + 100;
      await sleep(waitMs);
      continue;
    }

    const err = await msgRes.text();
    throw new Error(`DM send failed (${msgRes.status}): ${err}`);
  }
}

async function postWebhook(url, body) {
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    signal:  AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook failed (${res.status}): ${text}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
