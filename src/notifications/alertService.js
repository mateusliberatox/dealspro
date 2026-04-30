import { supabase } from '../database/supabase.js';
import { sendDiscordDM } from './discord.js';
import { logger } from '../utils/logger.js';

/**
 * For each newly inserted product, find matching active premium alerts
 * and dispatch Discord DM notifications.
 */
export async function matchAndNotify(products) {
  if (!products.length) return;

  // Fetch all active alerts for premium users
  const { data: alerts, error } = await supabase
    .from('user_alerts_dealspro')
    .select('id, user_id, keyword, size, dealspro_profiles!inner(plan, discord_user_id)')
    .eq('is_active', true)
    .eq('dealspro_profiles.plan', 'premium');

  if (error) {
    logger.error(`Alert fetch failed: ${error.message}`);
    return;
  }
  if (!alerts?.length) return;

  for (const product of products) {
    const searchText = `${product.nome} ${product.nome_traduzido ?? ''}`.toLowerCase();

    for (const alert of alerts) {
      const keywordMatch = searchText.includes(alert.keyword.toLowerCase());
      if (!keywordMatch) continue;

      const sizeMatch = !alert.size || (product.sizes ?? []).includes(alert.size);
      if (!sizeMatch) continue;

      const discordId = alert.dealspro_profiles?.discord_user_id;
      await dispatchDM({ alert, product, discordId });
    }
  }
}

async function dispatchDM({ alert, product, discordId }) {
  const logEntry = {
    user_id: alert.user_id,
    product_id: product.id,
    alert_id: alert.id,
    channel: 'discord_dm',
    status: 'pending',
  };

  if (!discordId) {
    await logNotification({ ...logEntry, status: 'failed', error: 'no_discord_id' });
    return;
  }

  try {
    await sendDiscordDM(discordId, product);
    await logNotification({ ...logEntry, status: 'sent' });
    logger.success(`Alert DM sent to user ${alert.user_id} for "${product.nome_traduzido || product.nome}"`);
  } catch (err) {
    await logNotification({ ...logEntry, status: 'failed', error: err.message });
    logger.error(`Alert DM failed: ${err.message}`);
  }
}

async function logNotification(entry) {
  const { error } = await supabase.from('notification_logs').insert(entry);
  if (error) logger.error(`Failed to log notification: ${error.message}`);
}
