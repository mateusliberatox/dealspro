import { sendToDiscord } from './discord.js';
import { logger } from '../utils/logger.js';

/**
 * Dispatches new products to all active notification channels.
 *
 * Phase 2 — delay system (free vs premium):
 *   - Premium: call sendToDiscord(products) immediately (already done here)
 *   - Free:    schedule sendToDiscord(products) after FREE_DELAY_MINUTES
 *              using a queue/job system (not yet implemented)
 */
export async function dispatchNotifications(products) {
  if (!products.length) return;

  logger.info(`Dispatching ${products.length} product(s) to notification channels`);

  try {
    await sendToDiscord(products);
  } catch (err) {
    logger.error(`Discord dispatch failed: ${err.message}`);
  }

  // Future channels:
  // await sendToWhatsApp(products);
  // await sendEmail(products);
}
