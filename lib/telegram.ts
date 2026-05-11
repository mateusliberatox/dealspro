const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const API     = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

export const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? '';

export function telegramConfigured() {
  return !!TOKEN;
}

export async function sendTelegramMessage(chatId: number | string, text: string): Promise<void> {
  if (!API) throw new Error('TELEGRAM_BOT_TOKEN não configurado');

  const res = await fetch(`${API}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      chat_id:    chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram sendMessage failed (${res.status}): ${err}`);
  }
}

export async function setTelegramWebhook(webhookUrl: string): Promise<boolean> {
  if (!API) return false;
  const res = await fetch(`${API}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url: webhookUrl, allowed_updates: ['message'] }),
  });
  return res.ok;
}

export function buildTelegramProductMessage(product: {
  nome_traduzido?: string | null;
  nome: string;
  preco?: string;
  link: string;
  categoria?: string | null;
}, isRestock = false): string {
  const nome      = product.nome_traduzido || product.nome;
  const categoria = product.categoria ? `📂 <b>${product.categoria}</b>\n` : '';
  const icon      = isRestock ? '🔄' : '🔔';
  const label     = isRestock ? 'Produto restocado!' : 'Novo produto encontrado!';

  return (
    `${icon} <b>${label}</b>\n\n` +
    categoria +
    `📦 ${nome}\n` +
    `💰 <b>${product.preco || 'Ver no site'}</b>\n\n` +
    `<a href="${product.link}">👉 Abrir no CSSDeals</a>\n\n` +
    `<i>DealsPro • cssdeals.com</i>`
  );
}
