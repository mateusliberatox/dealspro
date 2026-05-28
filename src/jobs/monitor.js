import { detectAndSaveNewProducts, enrichMissingQcImages } from '../services/productService.js';
import { closeBrowser } from '../scraper/browser.js';
import { logger } from '../utils/logger.js';
import 'dotenv/config';

// Ciclo rápido: scrape só da homepage para detectar novos produtos rapidamente
const FAST_INTERVAL = parseInt(process.env.FAST_SCRAPE_INTERVAL_SECONDS ?? '60',  10);
// Ciclo completo: homepage + todas as categorias
const FULL_INTERVAL = parseInt(process.env.SCRAPE_INTERVAL_SECONDS      ?? '180', 10);

export async function startMonitor() {
  logger.info(`Monitor starting — fast: ${FAST_INTERVAL}s, full: ${FULL_INTERVAL}s`);

  // Recupera produtos recentes que ficaram com imagem placeholder após restart.
  // Delay de 120s para não concorrer com o primeiro ciclo completo (~45s) de inicialização.
  setTimeout(
    () => enrichMissingQcImages().catch((e) => logger.warn(`QC rehydrate falhou: ${e.message}`)),
    120_000,
  );

  // Fast e full rodam em intervalos independentes — o full nunca bloqueia o fast.
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

const FAST_TIMEOUT_MS = 2 * 60 * 1000;  // 2 min — homepage só, não deve demorar mais
const FULL_TIMEOUT_MS = 10 * 60 * 1000; // 10 min — evita ciclo completo travado por Supabase/rede
const ALERT_AFTER_ERRORS = 3; // alerta após N erros consecutivos em qualquer ciclo

let fastCycleInProgress    = false;
let fullCycleInProgress    = false;
let cyclesCompleted        = 0;
let lastFastCycleAt        = null;
let lastFastCycleStatus    = null; // 'ok' | 'error' | null
let consecutiveFastErrors  = 0;
let lastFullCycleAt        = null;
let lastFullCycleStatus    = null; // 'ok' | 'error' | null
let consecutiveFullErrors  = 0;

export function getHealthStatus() {
  const fastDegraded = lastFastCycleStatus === 'error';
  const fullDegraded = lastFullCycleStatus === 'error';
  return {
    status:       (fastDegraded || fullDegraded) ? 'degraded' : 'ok',
    uptime:       Math.floor(process.uptime()),
    cyclesCompleted,
    fast: {
      lastAt:            lastFastCycleAt,
      status:            lastFastCycleStatus,
      consecutiveErrors: consecutiveFastErrors,
      interval:          FAST_INTERVAL,
    },
    full: {
      lastAt:            lastFullCycleAt,
      status:            lastFullCycleStatus,
      consecutiveErrors: consecutiveFullErrors,
      interval:          FULL_INTERVAL,
    },
  };
}

async function sendDegradationAlert(message) {
  // Usa o canal privado do admin — nunca o webhook premium público
  const url = process.env.DISCORD_ADMIN_WEBHOOK_URL ?? process.env.DISCORD_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ content: `🚨 **DealsPro Monitor** — ${message}` }),
    });
  } catch {
    // Best-effort — não bloqueia o ciclo se o alerta falhar
  }
}

// Ciclo rápido: só homepage, notificações premium imediatas.
// Nunca é bloqueado pelo ciclo completo.
async function runFastCycle() {
  if (fastCycleInProgress) {
    logger.warn('Fast cycle já em andamento — pulando');
    return;
  }

  fastCycleInProgress = true;
  try {
    const newProducts = await Promise.race([
      detectAndSaveNewProducts({ homepageOnly: true }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Fast cycle timeout (2min)')), FAST_TIMEOUT_MS),
      ),
    ]);
    lastFastCycleStatus   = 'ok';
    consecutiveFastErrors = 0;
    if (newProducts.length) {
      logger.success(`Fast cycle complete — ${newProducts.length} new product(s) found`, {
        names: newProducts.map((p) => p.nome),
      });
    } else {
      logger.info('Fast cycle complete — no new products');
    }
  } catch (err) {
    lastFastCycleStatus = 'error';
    consecutiveFastErrors++;
    logger.error(`Fast cycle failed (${consecutiveFastErrors} consecutive): ${err.message}`);
    if (consecutiveFastErrors >= ALERT_AFTER_ERRORS) {
      sendDegradationAlert(`${consecutiveFastErrors} ciclos rápidos consecutivos falharam. Último erro: ${err.message}`);
      consecutiveFastErrors = 0;
    }
  } finally {
    cyclesCompleted++;
    lastFastCycleAt     = new Date().toISOString();
    fastCycleInProgress = false;
  }
}

// Ciclo completo: homepage + todas as categorias, sync de disponibilidade,
// notificações free atrasadas. Roda independente do fast cycle.
async function runFullCycle() {
  if (fullCycleInProgress) {
    logger.warn('Full cycle já em andamento — pulando');
    return;
  }

  fullCycleInProgress = true;
  try {
    const newProducts = await Promise.race([
      detectAndSaveNewProducts({ homepageOnly: false }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Full cycle timeout (10min)')), FULL_TIMEOUT_MS),
      ),
    ]);
    lastFullCycleStatus   = 'ok';
    consecutiveFullErrors = 0;
    if (newProducts.length) {
      logger.success(`Full cycle complete — ${newProducts.length} new product(s) found`, {
        names: newProducts.map((p) => p.nome),
      });
    } else {
      logger.info('Full cycle complete — no new products');
    }
  } catch (err) {
    lastFullCycleStatus = 'error';
    consecutiveFullErrors++;
    logger.error(`Full cycle failed (${consecutiveFullErrors} consecutive): ${err.message}`);
    if (consecutiveFullErrors >= ALERT_AFTER_ERRORS) {
      sendDegradationAlert(`${consecutiveFullErrors} ciclos completos consecutivos falharam. Último erro: ${err.message}`);
      consecutiveFullErrors = 0;
    }
  } finally {
    cyclesCompleted++;
    lastFullCycleAt     = new Date().toISOString();
    fullCycleInProgress = false;
  }
}
