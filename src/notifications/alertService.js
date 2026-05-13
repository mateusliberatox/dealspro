import { supabase } from '../database/supabase.js';
import { sendDiscordDM } from './discord.js';
import { logger } from '../utils/logger.js';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegram(chatId, text, imageUrl = null) {
  if (!TELEGRAM_TOKEN) return;
  if (imageUrl) {
    const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, photo: imageUrl, caption: text, parse_mode: 'HTML' }),
    }).catch(() => ({ ok: false }));
    if (res.ok) return;
  }
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  }).catch(() => {});
}

/**
 * Verifica se este usuário já recebeu DM sobre este produto (por cssdeals_item_id ou product_id).
 * Restocks ignoram esta verificação — são sempre enviados.
 */
async function alreadyNotifiedUser(userId, productId, itemId, channels) {
  if (itemId) {
    const { data } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('cssdeals_item_id', itemId)
      .in('channel', channels)
      .limit(1);
    if ((data?.length ?? 0) > 0) return true;
  }
  if (productId) {
    const { data } = await supabase
      .from('notification_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('product_id', productId)
      .in('channel', channels)
      .limit(1);
    if ((data?.length ?? 0) > 0) return true;
  }
  return false;
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

      await dispatchDM({ alert, product, discordId, telegramId, isRestock });
    }
  }
}

async function dispatchDM({ alert, product, discordId, telegramId, isRestock = false }) {
  const nome   = product.nome_traduzido || product.nome;
  const itemId = product.cssdeals_item_id ?? null;

  // Deduplicação: restocks sempre enviam (são nova informação),
  // mas novos produtos só enviam se o usuário ainda não recebeu DM sobre este item.
  if (!isRestock) {
    const channels = ['discord_dm', 'telegram_dm'];
    if (await alreadyNotifiedUser(alert.user_id, product.id, itemId, channels)) {
      logger.info(`DM já enviado para ${alert.user_id} sobre produto ${itemId ?? product.id} — ignorado`);
      return;
    }
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
