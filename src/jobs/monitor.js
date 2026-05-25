import { detectAndSaveNewProducts } from '../services/productService.js';
import { closeBrowser } from '../scraper/browser.js';
import { logger } from '../utils/logger.js';
import 'dotenv/config';

// Ciclo rápido: scrape só da homepage para detectar novos produtos rapidamente
const FAST_INTERVAL = parseInt(process.env.FAST_SCRAPE_INTERVAL_SECONDS ?? '60',  10);
// Ciclo completo: homepage + todas as categorias
const FULL_INTERVAL = parseInt(process.env.SCRAPE_INTERVAL_SECONDS      ?? '180', 10);

export async function startMonitor() {
  logger.info(`Monitor starting — fast: ${FAST_INTERVAL}s, full: ${FULL_INTERVAL}s`);

  await runCycle();
  setInterval(runCycle, FAST_INTERVAL * 1000);

  const shutdown = async () => {
    logger.info('Shutting down...');
    await closeBrowser();
    process.exit(0);
  };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
}

const CYCLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 min — evita ciclo travado por Supabase/rede

let cycleInProgress  = false;
let lastFullCycleAt  = 0;
let cyclesCompleted  = 0;
let lastCycleAt      = null;
let lastCycleType    = null;
let lastCycleStatus  = null; // 'ok' | 'error'

export function getHealthStatus() {
  return {
    status:         lastCycleStatus === 'error' ? 'degraded' : 'ok',
    uptime:         Math.floor(process.uptime()),
    cyclesCompleted,
    lastCycleAt,
    lastCycleType,
    lastCycleStatus,
    fastInterval:   FAST_INTERVAL,
    fullInterval:   FULL_INTERVAL,
  };
}

async function runCycle() {
  if (cycleInProgress) {
    logger.warn('Ciclo anterior ainda em andamento — pulando');
    return;
  }

  const now          = Date.now();
  const homepageOnly = (now - lastFullCycleAt) < FULL_INTERVAL * 1000;
  if (!homepageOnly) lastFullCycleAt = now;

  cycleInProgress = true;
  try {
    const newProducts = await Promise.race([
      detectAndSaveNewProducts({ homepageOnly }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Cycle timeout (10min)')), CYCLE_TIMEOUT_MS),
      ),
    ]);
    lastCycleStatus = 'ok';
    if (newProducts.length) {
      logger.success(`Cycle complete (${homepageOnly ? 'fast' : 'full'}) — ${newProducts.length} new product(s) found`, {
        names: newProducts.map((p) => p.nome),
      });
    } else {
      logger.info(`Cycle complete (${homepageOnly ? 'fast' : 'full'}) — no new products`);
    }
  } catch (err) {
    lastCycleStatus = 'error';
    logger.error(`Cycle failed: ${err.message}`);
  } finally {
    cyclesCompleted++;
    lastCycleAt   = new Date().toISOString();
    lastCycleType = homepageOnly ? 'fast' : 'full';
    cycleInProgress = false;
  }
}
