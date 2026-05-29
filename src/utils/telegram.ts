const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Sends a Telegram message with optional photo.
 * Tries sendPhoto first; falls back to sendMessage if photo delivery fails.
 * Returns true if delivered.
 */
export async function sendTelegramMsg(
  chatId: number | string,
  text: string,
  imageUrl: string | null = null,
): Promise<boolean> {
  if (!TOKEN) return false;
  const opts = { signal: AbortSignal.timeout(10_000) };

  if (imageUrl) {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: text, parse_mode: 'HTML' }),
      ...opts,
    }).catch(() => ({ ok: false }) as Response);
    if (res.ok) return true;
  }

  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    ...opts,
  }).catch(() => ({ ok: false }) as Response);
  return res.ok;
}
