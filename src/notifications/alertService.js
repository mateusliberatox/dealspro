import { supabase } from '../database/supabase.js';
import { sendDiscordDM } from './discord.js';
import { logger } from '../utils/logger.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegram(chatId, text, imageUrl = null) {
  if (!TELEGRAM_TOKEN) return;
  const opts = { signal: AbortSignal.timeout(10_000) };
  if (imageUrl) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: text, parse_mode: 'HTML' }),
      ...opts,
    }).catch(() => ({ ok: false }));
    if (res.ok) return;
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    ...opts,
  }).catch(() => {});
}

/**
 * Para cada produto novo, encontra alertas ativos de usuários premium que coincidem
 * e despacha DM via Discord e/ou Telegram.
 */
export async function matchAndNotify(products, { isRestock = false } = {}) {
  if (!products.length) return;

  const { data: alerts, error: alertsError } = await supabase
    .from('user_alerts_dealspro')
    .select('id, user_id, keyword, size, categoria')
    .eq('is_active', true);

  if (alertsError) { logger.error(`Alert fetch failed: ${alertsError.message}`); return; }
  if (!alerts?.length) return;

  const userIds = [...new Set(alerts.map((a) => a.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('dealspro_profiles')
    .select('user_id, plan, discord_user_id, telegram_chat_id')
    .in('user_id', userIds)
    .eq('plan', 'premium');

  if (profilesError) { logger.error(`Profile fetch failed: ${profilesError.message}`); return; }
  if (!profiles?.length) return;

  const profileMap    = new Map(profiles.map((p) => [p.user_id, p]));
  const premiumAlerts = alerts.filter((a) => profileMap.has(a.user_id));
  if (!premiumAlerts.length) return;

  // Pré-busca todos os logs relevantes em UMA query para evitar N+1
  const notifiedSet = new Set();
  if (!isRestock) {
    const itemIds        = products.map((p) => p.cssdeals_item_id).filter(Boolean);
    const productIds     = products.map((p) => p.id).filter(Boolean);
    const premiumUserIds = [...new Set(premiumAlerts.map((a) => a.user_id))];

    const conditions = [];
    if (itemIds.length)    conditions.push(`cssdeals_item_id.in.(${itemIds.join(',')})`);
    if (productIds.length) conditions.push(`product_id.in.(${productIds.join(',')})`);

    if (conditions.length && premiumUserIds.length) {
      const { data: logs } = await supabase
        .from('notification_logs')
        .select('user_id, product_id, cssdeals_item_id')
        .in('user_id', premiumUserIds)
        .in('channel', ['discord_dm', 'telegram_dm'])
        .or(conditions.join(','));

      for (const l of logs ?? []) {
        if (l.cssdeals_item_id) notifiedSet.add(`${l.user_id}:${l.cssdeals_item_id}`);
        if (l.product_id)       notifiedSet.add(`${l.user_id}:pid${l.product_id}`);
      }
    }
  }

  for (const product of products) {
    const searchText = `${product.nome} ${product.nome_traduzido ?? ''}`.toLowerCase();

    for (const alert of premiumAlerts) {
      const hasKeyword   = !!alert.keyword;
      const hasCategoria = !!alert.categoria;

      const keywordMatch   = hasKeyword   && searchText.includes(alert.keyword.toLowerCase());
      const categoriaMatch = hasCategoria && product.categoria === alert.categoria;

      if (hasKeyword && hasCategoria) {
        if (!keywordMatch || !categoriaMatch) continue;
      } else if (hasKeyword) {
        if (!keywordMatch) continue;
      } else if (hasCategoria) {
        if (!categoriaMatch) continue;
      } else {
        continue;
      }

      const sizeMatch = !alert.size || (product.sizes ?? []).includes(alert.size);
      if (!sizeMatch) continue;

      const prof       = profileMap.get(alert.user_id);
      const discordId  = prof?.discord_user_id;
      const telegramId = prof?.telegram_chat_id;

      await dispatchDM({ alert, product, discordId, telegramId, isRestock, notifiedSet });
    }
  }
}

async function dispatchDM({ alert, product, discordId, telegramId, isRestock = false, notifiedSet = new Set() }) {
  const nome   = product.nome_traduzido || product.nome;
  const itemId = product.cssdeals_item_id ?? null;

  // Deduplicação via Set pré-carregado (evita query por par produto×usuário)
  if (!isRestock) {
    const seenByItem = itemId      && notifiedSet.has(`${alert.user_id}:${itemId}`);
    const seenByPid  = !itemId     && product.id && notifiedSet.has(`${alert.user_id}:pid${product.id}`);
    if (seenByItem || seenByPid) {
      logger.info(`DM dedup: ${alert.user_id} × ${itemId ?? product.id}`);
      return;
    }
    // Marca como visto agora para evitar duplicata no mesmo ciclo
    if (itemId)     notifiedSet.add(`${alert.user_id}:${itemId}`);
    if (product.id) notifiedSet.add(`${alert.user_id}:pid${product.id}`);
  }

  // Discord DM
  if (discordId) {
    try {
      await sendDiscordDM(discordId, product, isRestock);
      await logNotification({
        user_id:          alert.user_id,
        product_id:       product.id,
        cssdeals_item_id: itemId,
        alert_id:         alert.id,
        channel:          'discord_dm',
        status:           'sent',
      });
      logger.success(`Discord DM → ${alert.user_id} — "${nome}"`);
    } catch (err) {
      await logNotification({
        user_id:          alert.user_id,
        product_id:       product.id,
        cssdeals_item_id: itemId,
        alert_id:         alert.id,
        channel:          'discord_dm',
        status:           'failed',
        error:            err.message,
      });
      logger.error(`Discord DM falhou: ${err.message}`);
    }
    await sleep(500); // evita 429 ao enviar DMs em sequência rápida
  }

  // Telegram DM
  if (telegramId) {
    const icon  = isRestock ? '🔄' : '🔔';
    const label = isRestock ? 'Produto restocado!' : 'Novo produto encontrado!';
    const cat   = product.categoria ? `📂 <b>${product.categoria}</b>\n` : '';
    const text  =
      `${icon} <b>${label}</b>\n\n` +
      cat +
      `📦 ${nome}\n` +
      `💰 <b>${product.preco || 'Ver no site'}</b>\n\n` +
      `<a href="${product.link}">👉 Abrir no CSSDeals</a>`;

    try {
      await sendTelegram(telegramId, text, product.imagem || null);
      await logNotification({
        user_id:          alert.user_id,
        product_id:       product.id,
        cssdeals_item_id: itemId,
        alert_id:         alert.id,
        channel:          'telegram_dm',
        status:           'sent',
      });
      logger.success(`Telegram DM → ${alert.user_id} — "${nome}"`);
    } catch (err) {
      await logNotification({
        user_id:          alert.user_id,
        product_id:       product.id,
        cssdeals_item_id: itemId,
        alert_id:         alert.id,
        channel:          'telegram_dm',
        status:           'failed',
        error:            err.message,
      });
      logger.error(`Telegram DM falhou: ${err.message}`);
    }
    await sleep(500);
  }

  if (!discordId && !telegramId) {
    await logNotification({
      user_id:          alert.user_id,
      product_id:       product.id,
      cssdeals_item_id: itemId,
      alert_id:         alert.id,
      channel:          'discord_dm',
      status:           'failed',
      error:            'no_channel_configured',
    });
  }
}

async function logNotification(entry) {
  const { error } = await supabase.from('notification_logs').insert(entry);
  if (error) logger.error(`Failed to log notification: ${error.message}`);
}
