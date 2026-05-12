import { logger } from '../utils/logger.js';

const WEBHOOK_URL      = process.env.DISCORD_WEBHOOK_URL;
const FREE_WEBHOOK_URL = process.env.DISCORD_FREE_WEBHOOK_URL;
const BOT_TOKEN        = process.env.DISCORD_BOT_TOKEN;
const DISCORD_API = 'https://discord.com/api/v10';

const COLOR = 0xf97316;

const CATEGORY_EMOJI = {
  'Roupas': '👕',
  'Calçados': '👟',
  'Bolsa / Mochila': '👜',
  'Acessórios': '🕶️',
  'Smartwatch': '⌚',
  'Eletrônicos': '🔊',
  'Outros': '📦',
};

const BATCH_ANNOUNCE_THRESHOLD = 8; // anuncia no canal free quando lote >= N produtos novos

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
  }).catch(() => {}); // silencioso se falhar
  logger.success(`Announced batch of ${count} new products to free channel`);
}

// ── Webhook (channel feed) ────────────────────────────────────────────────────

export async function sendToDiscord(products) {
  if (!WEBHOOK_URL) { logger.warn('DISCORD_WEBHOOK_URL not set'); return; }
  if (!products.length) return;

  let sent = 0;
  for (const product of products) {
    try {
      await postWebhook(WEBHOOK_URL, {
        content: '🔥 **Novo produto detectado!**',
        embeds: [buildEmbed(product)],
      });
      sent++;
    } catch (err) {
      logger.warn(`Premium webhook failed for ${product.id}: ${err.message}`);
    }
    if (products.length > 1) await sleep(1000);
  }

  if (sent > 0) logger.success(`Discord webhook: sent ${sent}/${products.length} product(s)`);
}

// ── Free channel (delayed 30 min) ────────────────────────────────────────────

/**
 * Called every scraper cycle. Sends to the free webhook any products
 * that have now passed their visible_at and haven't been notified yet.
 */
export async function sendFreeDelayedNotifications() {
  if (!FREE_WEBHOOK_URL) return;

  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: due } = await supabase
    .from('produtos_dealspro')
    .select('*')
    .lte('visible_at', new Date().toISOString())
    .gte('criado_em', cutoff)
    .eq('free_notified', false)
    .order('criado_em', { ascending: true })
    .limit(20);

  if (!due?.length) return;

  for (const product of due) {
    let sent = false;
    try {
      await postWebhook(FREE_WEBHOOK_URL, {
        content: '⏰ **Novo produto disponível!**',
        embeds: [buildEmbed(product)],
      });
      sent = true;
    } catch (err) {
      logger.error(`Free webhook failed for ${product.id}: ${err.message}`);
    }

    // Só marca como notificado se o envio realmente ocorreu — falhas serão reprocessadas no próximo ciclo
    if (sent) {
      await supabase
        .from('produtos_dealspro')
        .update({ free_notified: true })
        .eq('id', product.id);
    }

    await sleep(1000);
  }

  logger.success(`Free Discord: sent ${due.length} delayed notification(s)`);
}

// ── Direct Message (premium alerts) ──────────────────────────────────────────

export async function sendDiscordDM(discordUserId, product, isRestock = false) {
  if (!BOT_TOKEN) throw new Error('DISCORD_BOT_TOKEN not configured');

  // 1. Open DM channel
  const channelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST',
    headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_id: discordUserId }),
  });

  if (!channelRes.ok) {
    const err = await channelRes.text();
    throw new Error(`DM channel open failed (${channelRes.status}): ${err}`);
  }

  const { id: channelId } = await channelRes.json();

  // 2. Send message
  const msgRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: isRestock
        ? '🔄 **Alerta DealsPro — produto restocado!**'
        : '🔔 **Alerta DealsPro — produto encontrado!**',
      embeds: [buildEmbed(product)],
    }),
  });

  if (!msgRes.ok) {
    const err = await msgRes.text();
    throw new Error(`DM send failed (${msgRes.status}): ${err}`);
  }
}

// ── Shared embed builder ──────────────────────────────────────────────────────

function buildEmbed(p) {
  const nome = p.nome_traduzido || p.nome;
  const original = p.nome_traduzido && p.nome_traduzido !== p.nome ? p.nome : null;
  const emoji = CATEGORY_EMOJI[p.categoria] ?? '📦';
  const categoria = p.categoria ?? 'Outros';

  const embed = {
    color: COLOR,
    author: { name: `${emoji}  ${categoria.toUpperCase()}  •  cssdeals.com` },
    title: truncate(nome, 200),
    url: p.link,
    fields: [
      { name: '💰 Preço', value: `**${p.preco || 'Ver no site'}**`, inline: true },
      { name: '🛒 Comprar', value: `[Abrir produto](${p.link})`, inline: true },
    ],
    footer: { text: 'DealsPro • cssdeals.com' },
    timestamp: new Date().toISOString(),
  };

  if (original) embed.description = `*Nome original: ${truncate(original, 150)}*`;

  // Rejeita placeholders e URLs inválidas
  const imagemValida = p.imagem &&
    /^https?:\/\/.+/.test(p.imagem) &&
    !/placeholder|800.?x.?900|via\.placeholder|picsum/i.test(p.imagem);
  if (imagemValida) embed.image = { url: p.imagem };

  if (p.sizes?.length) {
    embed.fields.push({ name: '📐 Tamanhos', value: p.sizes.join(' · '), inline: false });
  }

  return embed;
}

async function postWebhook(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Webhook failed (${res.status}): ${text}`);
  }
}

const truncate = (str, max) => str.length > max ? str.slice(0, max - 1) + '…' : str;
const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));
