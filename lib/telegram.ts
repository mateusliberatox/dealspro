const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const API     = TOKEN ? `https://api.telegram.org/bot${TOKEN}` : null;

export const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? '';

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

/**
 * Tries sendPhoto first; falls back to sendMessage if the photo fails.
 * Returns true if delivered. Used by the cron retry queue processor.
 */
export async function sendTelegramMedia(
  chatId: number | string,
  text: string,
  imageUrl: string | null = null,
): Promise<boolean> {
  if (!API) return false;
  const opts = { signal: AbortSignal.timeout(10_000) };

  if (imageUrl) {
    const res = await fetch(`${API}/sendPhoto`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: text, parse_mode: 'HTML' }),
      ...opts,
    }).catch(() => ({ ok: false }) as Response);
    if (res.ok) return true;
  }

  const res = await fetch(`${API}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    ...opts,
  }).catch(() => ({ ok: false }) as Response);
  return res.ok;
}

