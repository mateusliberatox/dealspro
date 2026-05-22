import { sendToDiscord } from './discord.js';
import { logger } from '../utils/logger.js';

/**
 * Dispatches new products to the premium Discord channel immediately.
 * Free channel delay is handled via visible_at in sendFreeDelayedNotifications.
 */
export async function dispatchNotifications(products) {
  if (!products.length) return;

  logger.info(`Dispatching ${products.length} product(s) to notification channels`);

  try {
    await sendToDiscord(products);
  } catch (err) {
    logger.error(`Discord dispatch failed: ${err.message}`);
  }
}
