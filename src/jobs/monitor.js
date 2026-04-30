import cron from 'node-cron';
import { detectAndSaveNewProducts } from '../services/productService.js';
import { closeBrowser } from '../scraper/browser.js';
import { logger } from '../utils/logger.js';
import 'dotenv/config';

const INTERVAL = parseInt(process.env.SCRAPE_INTERVAL_SECONDS ?? '60', 10);

/**
 * Runs one detection cycle immediately, then schedules recurring runs.
 * Uses node-cron for scheduling (cron expression built from the interval).
 *
 * For intervals < 60s, cron isn't granular enough — switch to setInterval.
 */
export async function startMonitor() {
  logger.info(`Monitor starting — interval: ${INTERVAL}s`);

  // Run immediately on start
  await runCycle();

  if (INTERVAL < 60) {
    // Sub-minute polling via setInterval
    setInterval(runCycle, INTERVAL * 1000);
  } else {
    const minutes = Math.floor(INTERVAL / 60);
    const expression = `*/${minutes} * * * *`;
    logger.info(`Cron expression: "${expression}"`);
    cron.schedule(expression, runCycle);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await closeBrowser();
    process.exit(0);
  });
}

async function runCycle() {
  try {
    const newProducts = await detectAndSaveNewProducts();
    if (newProducts.length) {
      logger.success(`Cycle complete — ${newProducts.length} new product(s) found`, {
        names: newProducts.map((p) => p.nome),
      });
    } else {
      logger.info('Cycle complete — no new products');
    }
  } catch (err) {
    logger.error(`Cycle failed: ${err.message}`);
  }
}
