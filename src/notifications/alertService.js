import { supabase } from '../database/supabase.js';
import { sendDiscordDM } from './discord.js';
import { logger } from '../utils/logger.js';

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function sendTelegram(chatId, text) {
  if (!TELEGRAM_TOKEN) return;
  await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  }).catch(() => {});
}

/**
 * For each newly inserted product, find matching active premium alerts
 * and dispatch Discord DM notifications.
 */
export async function matchAndNotify(products, { isRestock = false } = {}) {
  if (!products.length) return;

  // 1. Fetch all active alerts
  const { data: alerts, error: alertsError } = await supabase
    .from('user_alerts_dealspro')
    .select('id, user_id, keyword, size, categoria')
    .eq('is_active', true);

  if (alertsError) {
    logger.error(`Alert fetch failed: ${alertsError.message}`);
    return;
  }
  if (!alerts?.length) return;

  // 2. Fetch profiles only for users that have active alerts (premium check)
  const userIds = [...new Set(alerts.map((a) => a.user_id))];
  const { data: profiles, error: profilesError } = await supabase
    .from('dealspro_profiles')
    .select('user_id, plan, discord_user_id, telegram_chat_id')
    .in('user_id', userIds)
    .eq('plan', 'premium');

  if (profilesError) {
    logger.error(`Profile fetch failed: ${profilesError.message}`);
    return;
  }
  if (!profiles?.length) return;

  // 3. Build profile lookup and filter to premium-only alerts
  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
  const premiumAlerts = alerts.filter((a) => profileMap.has(a.user_id));
  if (!premiumAlerts.length) return;

  for (const product of products) {
    const searchText = `${product.nome} ${product.nome_traduzido ?? ''}`.toLowerCase();

    for (const alert of premiumAlerts) {
      // Um alerta dispara quando satisfaz keyword OU categoria (ambos opcionais entre si)
      // mas ao menos um deve estar preenchido e coincidir.
      const hasKeyword   = !!alert.keyword;
      const hasCategoria = !!alert.categoria;

      const keywordMatch   = hasKeyword   && searchText.includes(alert.keyword.toLowerCase());
      const categoriaMatch = hasCategoria && product.categoria === alert.categoria;

      if (hasKeyword && hasCategoria) {
        // Ambos preenchidos → os dois devem coincidir
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
  const nome = product.nome_traduzido || product.nome;

  // Discord DM
  if (discordId) {
    try {
      await sendDiscordDM(discordId, product, isRestock);
      await logNotification({ user_id: alert.user_id, product_id: product.id, alert_id: alert.id, channel: 'discord_dm', status: 'sent' });
      logger.success(`Discord DM sent to user ${alert.user_id} for "${nome}"`);
    } catch (err) {
      await logNotification({ user_id: alert.user_id, product_id: product.id, alert_id: alert.id, channel: 'discord_dm', status: 'failed', error: err.message });
      logger.error(`Discord DM failed: ${err.message}`);
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
      await sendTelegram(telegramId, text);
      await logNotification({ user_id: alert.user_id, product_id: product.id, alert_id: alert.id, channel: 'telegram_dm', status: 'sent' });
      logger.success(`Telegram DM sent to user ${alert.user_id} for "${nome}"`);
    } catch (err) {
      await logNotification({ user_id: alert.user_id, product_id: product.id, alert_id: alert.id, channel: 'telegram_dm', status: 'failed', error: err.message });
      logger.error(`Telegram DM failed: ${err.message}`);
    }
  }

  if (!discordId && !telegramId) {
    await logNotification({ user_id: alert.user_id, product_id: product.id, alert_id: alert.id, channel: 'discord_dm', status: 'failed', error: 'no_channel_configured' });
  }
}

async function logNotification(entry) {
  const { error } = await supabase.from('notification_logs').insert(entry);
  if (error) logger.error(`Failed to log notification: ${error.message}`);
}
