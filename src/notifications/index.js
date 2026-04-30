/**
 * Notification dispatcher — Phase 2.
 *
 * Channels planned:
 *   - Discord (free tier: delayed, premium: real-time)
 *   - WhatsApp
 *   - Email
 *
 * To activate: uncomment the hook in productService.js and implement below.
 */

// import { sendDiscord } from './discord.js';

export async function dispatchNotifications(products) {
  if (!products.length) return;

  for (const product of products) {
    // await sendDiscord(product);
    console.log('[notifications] Product queued (not yet implemented):', product.nome);
  }
}
