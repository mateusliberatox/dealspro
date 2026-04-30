import { logger } from '../utils/logger.js';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const COLOR = 0xf97316; // orange

const CATEGORY_EMOJI = {
  'Smartwatch': '⌚',
  'Bolsa / Mochila': '👜',
  'Roupas': '👕',
  'Eletrônicos': '🔊',
  'Calçados': '👟',
  'Outros': '📦',
};

export async function sendToDiscord(products) {
  if (!WEBHOOK_URL) {
    logger.warn('DISCORD_WEBHOOK_URL not set — skipping notification');
    return;
  }
  if (!products.length) return;

  // Send one message per product for maximum visibility in the feed
  for (const product of products) {
    await postProduct(product);
    if (products.length > 1) await sleep(1000); // respect rate limit
  }

  logger.success(`Discord: sent ${products.length} product(s)`);
}

async function postProduct(p) {
  const nome = p.nome_traduzido || p.nome;
  const original = p.nome_traduzido && p.nome_traduzido !== p.nome ? p.nome : null;
  const emoji = CATEGORY_EMOJI[p.categoria] ?? '📦';
  const categoria = p.categoria ?? 'Outros';

  const embed = {
    color: COLOR,
    author: {
      name: `${emoji}  ${categoria.toUpperCase()}  •  cssdeals.com`,
    },
    title: truncate(nome, 200),
    url: p.link,
    fields: [
      { name: '💰 Preço', value: `**${p.preco || 'Ver no site'}**`, inline: true },
      { name: '🛒 Comprar', value: `[Abrir produto](${p.link})`, inline: true },
    ],
    footer: { text: 'DealsPro • cssdeals.com' },
    timestamp: new Date().toISOString(),
  };

  if (original) {
    embed.description = `*Nome original: ${truncate(original, 150)}*`;
  }

  if (p.imagem) {
    embed.image = { url: p.imagem };
  }

  await postWebhook({
    content: '🔥 **Novo produto detectado!**',
    embeds: [embed],
  });
}

async function postWebhook(body) {
  const res = await fetch(WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Discord webhook failed (${res.status}): ${text}`);
  }
}

const truncate = (str, max) => str.length > max ? str.slice(0, max - 1) + '…' : str;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
