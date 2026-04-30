import { logger } from '../utils/logger.js';

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

const COLOR_DEAL = 0xf97316; // orange — stands out in dark theme

/**
 * Sends new products to Discord as rich embeds.
 * Batches up to 10 embeds per request (Discord limit).
 * Silently skips if DISCORD_WEBHOOK_URL is not configured.
 */
export async function sendToDiscord(products) {
  if (!WEBHOOK_URL) {
    logger.warn('DISCORD_WEBHOOK_URL not set — skipping notification');
    return;
  }
  if (!products.length) return;

  const batches = chunk(products, 10);

  for (const batch of batches) {
    const embeds = batch.map(buildEmbed);
    await postWebhook({ embeds });
    // Respect Discord rate limit between batches
    if (batches.length > 1) await sleep(1000);
  }

  logger.success(`Discord: sent ${products.length} product(s)`);
}

function buildEmbed(product) {
  const nome = truncate(product.nome, 200);
  const preco = product.preco || 'N/A';

  const embed = {
    title: nome,
    url: product.link,
    color: COLOR_DEAL,
    fields: [
      { name: '💰 Preço', value: `**${preco}**`, inline: true },
      { name: '🛒 Comprar', value: `[Ver produto](${product.link})`, inline: true },
    ],
    footer: { text: 'cssdeals.com • DealsPro' },
    timestamp: new Date().toISOString(),
  };

  if (product.imagem) {
    embed.thumbnail = { url: product.imagem };
  }

  return embed;
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
const chunk = (arr, size) => Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
