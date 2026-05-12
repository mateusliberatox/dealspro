/**
 * Envia o feed de deals via Telegram respeitando o plano do usuário.
 * Premium → imediato. Free → após visible_at (30 min).
 */

import { supabase } from '../database/supabase.js';
import { logger } from '../utils/logger.js';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const MODES = ['all_deals', 'both'];
const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));
const RATE_DELAY = 350; // ~3 msgs/s — seguro dentro do limite do Telegram (30 msgs/s por bot)

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
  if (imageUrl) {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendPhoto`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: text, parse_mode: 'HTML' }),
    });
    if (res.ok) return true;
    // fallback para texto se a imagem falhar
  }
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  return res.ok;
}

async function logSent(userId, productId) {
  const { error } = await supabase.from('notification_logs').insert({
    user_id:    userId,
    product_id: productId,
    channel:    'telegram_feed',
    status:     'sent',
  });
  if (error) logger.error(`logSent falhou user=${userId} product=${productId}: ${error.message}`);
}

async function alreadySent(userId, productId) {
  const { data } = await supabase
    .from('notification_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('product_id', productId)
    .eq('channel', 'telegram_feed')
    .limit(1);
  return (data?.length ?? 0) > 0;
}

// ── Premium: envia imediatamente para usuários com all_deals/both ─────────────

export async function notifyTelegramPremiumFeed(products) {
  if (!TOKEN || !products.length) return;

  const { data: users } = await supabase
    .from('dealspro_profiles')
    .select('user_id, telegram_chat_id')
    .eq('plan', 'premium')
    .in('telegram_notify_mode', MODES)
    .not('telegram_chat_id', 'is', null);

  if (!users?.length) return;

  let sent = 0;
  for (const user of users) {
    for (const product of products) {
      if (await alreadySent(user.user_id, product.id)) continue;
      const ok = await sendMsg(user.telegram_chat_id, buildMessage(product), product.imagem || null);
      if (ok) { await logSent(user.user_id, product.id); sent++; }
      await SLEEP(RATE_DELAY);
    }
  }
  if (sent > 0) logger.success(`Telegram premium feed: ${sent} mensagem(ns) enviada(s)`);
}

// ── Free: envia quando visible_at passou (roda a cada ciclo do scraper) ───────

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
    .limit(20);

  if (!products?.length) return;

  let sent = 0;
  for (const user of users) {
    for (const product of products) {
      if (await alreadySent(user.user_id, product.id)) continue;
      const ok = await sendMsg(user.telegram_chat_id, buildMessage(product), product.imagem || null);
      if (ok) { await logSent(user.user_id, product.id); sent++; }
      await SLEEP(RATE_DELAY);
    }
  }
  if (sent > 0) logger.success(`Telegram free feed: ${sent} mensagem(ns) enviada(s)`);
}
