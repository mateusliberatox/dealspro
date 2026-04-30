import { logger } from '../utils/logger.js';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const BOT_TOKEN   = process.env.DISCORD_BOT_TOKEN;
const DISCORD_API = 'https://discord.com/api/v10';

const COLOR = 0xf97316;

const CATEGORY_EMOJI = {
  'Smartwatch': '⌚',
  'Bolsa / Mochila': '👜',
  'Roupas': '👕',
  'Eletrônicos': '🔊',
  'Calçados': '👟',
  'Outros': '📦',
};

// ── Webhook (channel feed) ────────────────────────────────────────────────────

export async function sendToDiscord(products) {
  if (!WEBHOOK_URL) { logger.warn('DISCORD_WEBHOOK_URL not set'); return; }
  if (!products.length) return;

  for (const product of products) {
    await postWebhook(WEBHOOK_URL, {
      content: '🔥 **Novo produto detectado!**',
      embeds: [buildEmbed(product)],
    });
    if (products.length > 1) await sleep(1000);
  }

  logger.success(`Discord webhook: sent ${products.length} product(s)`);
}

// ── Direct Message (premium alerts) ──────────────────────────────────────────

export async function sendDiscordDM(discordUserId, product) {
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
      content: '🔔 **Alerta DealsPro — produto encontrado!**',
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
  if (p.imagem)  embed.image = { url: p.imagem };

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
