import { detectAndSaveNewProducts, enrichMissingQcImages } from '../services/productService.js';
import { closeBrowser } from '../scraper/browser.js';
import { logger } from '../utils/logger.js';
import 'dotenv/config';

const FAST_INTERVAL = parseInt(process.env.FAST_SCRAPE_INTERVAL_SECONDS ?? '60',  10);
const FULL_INTERVAL = parseInt(process.env.SCRAPE_INTERVAL_SECONDS      ?? '180', 10);

export async function startMonitor(): Promise<void> {
  logger.info(`Monitor starting — fast: ${FAST_INTERVAL}s, full: ${FULL_INTERVAL}s`);

  setTimeout(
    () => enrichMissingQcImages().catch((e: Error) => logger.warn(`QC rehydrate falhou: ${e.message}`)),
    120_000,
  );

  runFastCycle();
  runFullCycle();
  setInterval(runFastCycle, FAST_INTERVAL * 1000);
  setInterval(runFullCycle, FULL_INTERVAL * 1000);

  const shutdown = async () => {
    logger.info('Shutting down...');
    await closeBrowser();
    process.exit(0);
  };
  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
}

const FAST_TIMEOUT_MS    = 2  * 60 * 1000;
const FULL_TIMEOUT_MS    = 10 * 60 * 1000;
const ALERT_AFTER_ERRORS = 3;

let fastCycleInProgress   = false;
let fullCycleInProgress   = false;
let cyclesCompleted       = 0;
let lastFastCycleAt:      string | null = null;
let lastFastCycleStatus:  'ok' | 'error' | null = null;
let consecutiveFastErrors = 0;
let lastFullCycleAt:      string | null = null;
let lastFullCycleStatus:  'ok' | 'error' | null = null;
let consecutiveFullErrors = 0;

interface HealthStatus {
  status:         'ok' | 'degraded';
  uptime:         number;
  cyclesCompleted: number;
  fast: { lastAt: string | null; status: 'ok' | 'error' | null; consecutiveErrors: number; interval: number };
  full: { lastAt: string | null; status: 'ok' | 'error' | null; consecutiveErrors: number; interval: number };
}

export function getHealthStatus(): HealthStatus {
  return {
    status:          (lastFastCycleStatus === 'error' || lastFullCycleStatus === 'error') ? 'degraded' : 'ok',
    uptime:          Math.floor(process.uptime()),
    cyclesCompleted,
    fast: { lastAt: lastFastCycleAt, status: lastFastCycleStatus, consecutiveErrors: consecutiveFastErrors, interval: FAST_INTERVAL },
    full: { lastAt: lastFullCycleAt, status: lastFullCycleStatus, consecutiveErrors: consecutiveFullErrors, interval: FULL_INTERVAL },
  };
}

async function sendDegradationAlert(message: string): Promise<void> {
  const url = process.env.DISCORD_ADMIN_WEBHOOK_URL ?? process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: `🚨 **DealsPro Monitor** — ${message}` }),
    });
  } catch { /* best-effort */ }
}

async function runFastCycle(): Promise<void> {
  if (fastCycleInProgress) { logger.warn('Fast cycle já em andamento — pulando'); return; }

  fastCycleInProgress = true;
  try {
    const newProducts = await Promise.race([
      detectAndSaveNewProducts({ homepageOnly: true }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Fast cycle timeout (2min)')), FAST_TIMEOUT_MS),
      ),
    ]);
    lastFastCycleStatus   = 'ok';
    consecutiveFastErrors = 0;
    if (newProducts.length) {
      logger.success(`Fast cycle complete — ${newProducts.length} new product(s) found`, { names: newProducts.map((p) => p.nome) });
    } else {
      logger.info('Fast cycle complete — no new products');
    }
  } catch (err: unknown) {
    lastFastCycleStatus = 'error';
    consecutiveFastErrors++;
    logger.error(`Fast cycle failed (${consecutiveFastErrors} consecutive): ${(err as Error).message}`);
    if (consecutiveFastErrors >= ALERT_AFTER_ERRORS) {
      sendDegradationAlert(`${consecutiveFastErrors} ciclos rápidos consecutivos falharam. Último erro: ${(err as Error).message}`);
      consecutiveFastErrors = 0;
    }
  } finally {
    cyclesCompleted++;
    lastFastCycleAt     = new Date().toISOString();
    fastCycleInProgress = false;
  }
}

async function runFullCycle(): Promise<void> {
  if (fullCycleInProgress) { logger.warn('Full cycle já em andamento — pulando'); return; }

  fullCycleInProgress = true;
  try {
    const newProducts = await Promise.race([
      detectAndSaveNewProducts({ homepageOnly: false }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Full cycle timeout (10min)')), FULL_TIMEOUT_MS),
      ),
    ]);
    lastFullCycleStatus   = 'ok';
    consecutiveFullErrors = 0;
    if (newProducts.length) {
      logger.success(`Full cycle complete — ${newProducts.length} new product(s) found`, { names: newProducts.map((p) => p.nome) });
    } else {
      logger.info('Full cycle complete — no new products');
    }
  } catch (err: unknown) {
    lastFullCycleStatus = 'error';
    consecutiveFullErrors++;
    logger.error(`Full cycle failed (${consecutiveFullErrors} consecutive): ${(err as Error).message}`);
    if (consecutiveFullErrors >= ALERT_AFTER_ERRORS) {
      sendDegradationAlert(`${consecutiveFullErrors} ciclos completos consecutivos falharam. Último erro: ${(err as Error).message}`);
      consecutiveFullErrors = 0;
    }
  } finally {
    cyclesCompleted++;
    lastFullCycleAt     = new Date().toISOString();
    fullCycleInProgress = false;
  }
}
