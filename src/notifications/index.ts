import { sendToDiscord } from './discord.js';
import { logger } from '../utils/logger.js';
import type { Product } from '../types.js';

/** Dispatches new products to the premium Discord channel immediately. */
export async function dispatchNotifications(products: Product[]): Promise<void> {
  if (!products.length) return;

  logger.info(`Dispatching ${products.length} product(s) to notification channels`);

  try {
    await sendToDiscord(products);
  } catch (err: unknown) {
    logger.error(`Discord dispatch failed: ${(err as Error).message}`);
  }
}
