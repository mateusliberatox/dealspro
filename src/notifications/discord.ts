import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger.js';
import { buildDiscordEmbed } from '../utils/discordEmbed.js';
import type { Product } from '../types.js';

const WEBHOOK_URL     = process.env.DISCORD_WEBHOOK_URL;
const FREE_WEBHOOK_URL = process.env.DISCORD_FREE_WEBHOOK_URL;
const BOT_TOKEN       = process.env.DISCORD_BOT_TOKEN;
const DISCORD_API     = 'https://discord.com/api/v10';

const BATCH_ANNOUNCE_THRESHOLD = 8;
const FREE_NOTIFY_BATCH_SIZE   = parseInt(process.env.FREE_NOTIFY_BATCH_SIZE ?? '50', 10);

let _db: SupabaseClient | null = null;
function getDb(): SupabaseClient {
  if (!_db) _db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  return _db;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Deduplicação ──────────────────────────────────────────────────────────────

async function logSent(
  channel: string,
  productId: string | number | null | undefined,
  itemId: string | null | undefined,
  discordMessageId: string | null = null,
): Promise<void> {
  const { error } = await getDb().from('notification_logs').insert({
    product_id:         productId        ?? null,
    cssdeals_item_id:   itemId           ?? null,
    discord_message_id: discordMessageId ?? null,
    channel,
    status: 'sent',
  });
  if (error) logger.error(`logSent [${channel}] falhou product=${productId}: ${error.message}`);
}

// ── Anúncio de lote grande ────────────────────────────────────────────────────

export async function announceNewBatch(count: number, categories: (string | null | undefined)[]): Promise<void> {
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

// ── Canal premium (imediato) ──────────────────────────────────────────────────

export async function sendToDiscord(products: Product[]): Promise<void> {
  if (!WEBHOOK_URL || !products.length) return;

  const db = getDb();

  const itemIds    = products.map((p) => p.cssdeals_item_id).filter(Boolean);
  const productIds = products.map((p) => p.id).filter(Boolean);
  const conditions: string[] = [];
  if (itemIds.length)    conditions.push(`cssdeals_item_id.in.(${itemIds.join(',')})`);
  if (productIds.length) conditions.push(`product_id.in.(${productIds.join(',')})`);

  const sentSet = new Set<string>();
  if (conditions.length) {
    const { data: logs } = await db
      .from('notification_logs')
      .select('product_id, cssdeals_item_id')
      .eq('channel', 'discord_premium')
      .or(conditions.join(','));
    for (const l of (logs ?? []) as Array<{ product_id?: string | number; cssdeals_item_id?: string | null }>) {
      if (l.cssdeals_item_id) sentSet.add(`item:${l.cssdeals_item_id}`);
      if (l.product_id)       sentSet.add(`pid:${l.product_id}`);
    }
  }

  let sent = 0;
  for (const product of products) {
    const itemId      = product.cssdeals_item_id ?? null;
    const alreadySent = (itemId && sentSet.has(`item:${itemId}`)) ||
                        (!itemId && sentSet.has(`pid:${product.id}`));

    if (alreadySent) {
      logger.info(`Discord premium: produto ${itemId ?? product.id} já enviado — ignorado`);
      continue;
    }

    try {
      const msg = await postWebhook(WEBHOOK_URL, {
        content: '🔥 **Novo produto detectado!**',
        embeds:  [buildDiscordEmbed(product)],
      }, { waitForMessage: true });
      await logSent('discord_premium', product.id, itemId, (msg as Record<string, string> | null)?.id ?? null);
      sentSet.add(itemId ? `item:${itemId}` : `pid:${product.id}`);
      sent++;
    } catch (err: unknown) {
      logger.warn(`Premium webhook failed for ${product.id}: ${(err as Error).message}`);
    }

    if (products.length > 1) await sleep(500);
  }

  if (sent > 0) logger.success(`Discord webhook premium: ${sent}/${products.length} produto(s)`);
}

// ── Canal free (retardado 30 min) ─────────────────────────────────────────────

export async function sendFreeDelayedNotifications(): Promise<void> {
  if (!FREE_WEBHOOK_URL) return;

  const db     = getDb();
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

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

  const itemIds    = (due as Product[]).map((p) => p.cssdeals_item_id).filter(Boolean);
  const productIds = (due as Product[]).map((p) => p.id).filter(Boolean);
  const conditions: string[] = [];
  if (itemIds.length)    conditions.push(`cssdeals_item_id.in.(${itemIds.join(',')})`);
  if (productIds.length) conditions.push(`product_id.in.(${productIds.join(',')})`);

  const sentSet = new Set<string>();
  if (conditions.length) {
    const { data: logs } = await db
      .from('notification_logs').select('product_id, cssdeals_item_id')
      .eq('channel', 'discord_free').or(conditions.join(','));
    for (const l of (logs ?? []) as Array<{ product_id?: string | number; cssdeals_item_id?: string | null }>) {
      if (l.cssdeals_item_id) sentSet.add(`item:${l.cssdeals_item_id}`);
      if (l.product_id)       sentSet.add(`pid:${l.product_id}`);
    }
  }

  let sent = 0;
  for (const product of due as Product[]) {
    const itemId      = product.cssdeals_item_id ?? null;
    const alreadySent = (itemId && sentSet.has(`item:${itemId}`)) ||
                        (!itemId && sentSet.has(`pid:${product.id}`));

    if (alreadySent) {
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
    } catch (err: unknown) {
      logger.error(`Free webhook failed for ${product.id}: ${(err as Error).message}`);
    }

    if (ok) {
      await db.from('produtos_dealspro').update({ free_notified: true }).eq('id', product.id);
      await logSent('discord_free', product.id, itemId);
      sentSet.add(itemId ? `item:${itemId}` : `pid:${product.id}`);
      sent++;
    }

    await sleep(500);
  }

  if (sent > 0) logger.success(`Discord free: ${sent} notificação(ões) enviada(s)`);
}

// ── Restock: anuncia nos feeds premium e free ────────────────────────────────

export async function announceRestock(products: Product[]): Promise<void> {
  if (!products.length) return;
  await postRestockToChannel(products, WEBHOOK_URL, 'discord_restock_premium');
  await postRestockToChannel(products, FREE_WEBHOOK_URL, 'discord_restock_free');
}

async function postRestockToChannel(products: Product[], webhookUrl: string | undefined, channel: string): Promise<void> {
  if (!webhookUrl || !products.length) return;

  const db = getDb();

  const itemIds    = products.map((p) => p.cssdeals_item_id).filter(Boolean);
  const productIds = products.map((p) => p.id).filter(Boolean);
  const conditions: string[] = [];
  if (itemIds.length)    conditions.push(`cssdeals_item_id.in.(${itemIds.join(',')})`);
  if (productIds.length) conditions.push(`product_id.in.(${productIds.join(',')})`);

  const sentSet = new Set<string>();
  if (conditions.length) {
    const { data: logs } = await db
      .from('notification_logs')
      .select('product_id, cssdeals_item_id')
      .eq('channel', channel)
      .or(conditions.join(','));
    for (const l of (logs ?? []) as Array<{ product_id?: string | number; cssdeals_item_id?: string | null }>) {
      if (l.cssdeals_item_id) sentSet.add(`item:${l.cssdeals_item_id}`);
      if (l.product_id)       sentSet.add(`pid:${l.product_id}`);
    }
  }

  let sent = 0;
  for (const product of products) {
    const itemId      = product.cssdeals_item_id ?? null;
    const alreadySent = (itemId && sentSet.has(`item:${itemId}`)) ||
                        (!itemId && sentSet.has(`pid:${product.id}`));

    if (alreadySent) continue;

    try {
      await postWebhook(webhookUrl, {
        content: '🔄 **Produto restocado!**',
        embeds:  [buildDiscordEmbed(product, { isRestock: true })],
      });
      await logSent(channel, product.id, itemId);
      sentSet.add(itemId ? `item:${itemId}` : `pid:${product.id}`);
      sent++;
    } catch (err: unknown) {
      logger.warn(`Restock webhook [${channel}] failed for ${product.id}: ${(err as Error).message}`);
    }

    if (products.length > 1) await sleep(500);
  }

  if (sent > 0) logger.success(`Discord restock [${channel}]: ${sent}/${products.length} produto(s)`);
}

// ── DM de alerta (premium) ────────────────────────────────────────────────────

export async function sendDiscordDM(discordUserId: string, product: Product, isRestock = false): Promise<void> {
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

  const { id: channelId } = await channelRes.json() as { id: string };

  const payload = JSON.stringify({
    content: isRestock
      ? '🔄 **Alerta DealsPro — produto restocado!**'
      : '🔔 **Alerta DealsPro — produto encontrado!**',
    embeds: [buildDiscordEmbed(product)],
  });

  for (let attempt = 1; attempt <= 2; attempt++) {
    const msgRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
      method:  'POST',
      headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
      body:    payload,
      signal:  AbortSignal.timeout(10_000),
    });

    if (msgRes.ok) return;

    if (msgRes.status === 429 && attempt < 2) {
      const body  = await msgRes.json().catch(() => ({})) as { retry_after?: number };
      const waitMs = Math.ceil((body.retry_after ?? 1) * 1000) + 100;
      await sleep(waitMs);
      continue;
    }

    const err = await msgRes.text();
    throw new Error(`DM send failed (${msgRes.status}): ${err}`);
  }
}

async function postWebhook(
  url: string,
  body: Record<string, unknown>,
  { waitForMessage = false } = {},
): Promise<unknown> {
  const target = waitForMessage ? `${url}?wait=true` : url;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetch(target, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(10_000),
    });

    if (res.ok) return waitForMessage ? res.json() : null;

    if (res.status === 429) {
      const rb     = await res.json().catch(() => ({})) as { retry_after?: number };
      const waitMs = Math.ceil((rb.retry_after ?? 1) * 1000) + 100;
      await sleep(waitMs);
      continue;
    }

    if (res.status >= 500 && attempt < 3) {
      await sleep(1000 * attempt);
      continue;
    }

    const text = await res.text();
    throw new Error(`Webhook failed (${res.status}): ${text}`);
  }

  throw new Error('Webhook failed after 3 attempts');
}

function parseWebhookUrl(url: string | undefined): { id: string; token: string } | null {
  const match = url?.match(/\/webhooks\/(\d+)\/([^/?]+)/);
  return match ? { id: match[1], token: match[2] } : null;
}

export async function updateQcImagesInDiscord(products: Product[]): Promise<void> {
  if (!WEBHOOK_URL || !products.length) return;

  const webhook = parseWebhookUrl(WEBHOOK_URL);
  if (!webhook) return;

  const db         = getDb();
  const productIds = products.map((p) => p.id).filter(Boolean);

  const { data: logs } = await db
    .from('notification_logs')
    .select('product_id, discord_message_id')
    .eq('channel', 'discord_premium')
    .in('product_id', productIds)
    .not('discord_message_id', 'is', null);

  if (!logs?.length) return;

  const messageMap = new Map(
    (logs as Array<{ product_id: string | number; discord_message_id: string }>)
      .map((l) => [l.product_id, l.discord_message_id]),
  );

  let updated = 0;
  for (const product of products) {
    const messageId = messageMap.get(product.id!);
    if (!messageId) continue;

    try {
      const res = await fetch(
        `${DISCORD_API}/webhooks/${webhook.id}/${webhook.token}/messages/${messageId}`,
        {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ embeds: [buildDiscordEmbed(product)] }),
          signal:  AbortSignal.timeout(10_000),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        logger.warn(`QC edit failed for product ${product.id} (${res.status}): ${text}`);
        continue;
      }
      updated++;
    } catch (err: unknown) {
      logger.warn(`QC edit failed for product ${product.id}: ${(err as Error).message}`);
    }

    if (products.length > 1) await sleep(500);
  }

  if (updated > 0) logger.success(`QC: ${updated} embed(s) atualizados no Discord`);
}
