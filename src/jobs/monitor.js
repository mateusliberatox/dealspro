import { detectAndSaveNewProducts } from '../services/productService.js';
import { closeBrowser } from '../scraper/browser.js';
import { logger } from '../utils/logger.js';
import 'dotenv/config';

const INTERVAL = parseInt(process.env.SCRAPE_INTERVAL_SECONDS ?? '90', 10);

export async function startMonitor() {
  logger.info(`Monitor starting — interval: ${INTERVAL}s`);

  await runCycle();
  setInterval(runCycle, INTERVAL * 1000);

  process.on('SIGINT', async () => {
    logger.info('Shutting down...');
    await closeBrowser();
    process.exit(0);
  });
}

const CYCLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 min — evita ciclo travado por Supabase/rede

let cycleInProgress = false;

async function runCycle() {
  if (cycleInProgress) {
    logger.warn('Ciclo anterior ainda em andamento — pulando');
    return;
  }
  cycleInProgress = true;
  try {
    const newProducts = await Promise.race([
      detectAndSaveNewProducts(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Cycle timeout (10min)')), CYCLE_TIMEOUT_MS),
      ),
    ]);
    if (newProducts.length) {
      logger.success(`Cycle complete — ${newProducts.length} new product(s) found`, {
        names: newProducts.map((p) => p.nome),
      });
    } else {
      logger.info('Cycle complete — no new products');
    }
  } catch (err) {
    logger.error(`Cycle failed: ${err.message}`);
  } finally {
    cycleInProgress = false;
  }
}
