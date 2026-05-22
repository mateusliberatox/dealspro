import { scrapeCssDeals, fetchQcImage } from '../scraper/index.js';
import { getExistingHashMap, insertProducts, mergeSizes, deleteOldProducts, syncAvailability } from '../database/products.js';
import { generateProductHash } from '../utils/hash.js';
import { translateName } from '../utils/translate.js';
import { categorize } from '../utils/categorize.js';
import { logger } from '../utils/logger.js';
import { dispatchNotifications } from '../notifications/index.js';
import { matchAndNotify } from '../notifications/alertService.js';
import { sendFreeDelayedNotifications, announceNewBatch } from '../notifications/discord.js';
import { notifyTelegramPremiumFeed, notifyTelegramFreeFeed } from '../notifications/telegramFeed.js';
import { supabase } from '../database/supabase.js';

const MAX_QC_FETCHES        = 100;
const QC_BATCH_SIZE         = 12;
const FREE_DELAY_MS         = 30 * 60 * 1000;
const MIN_SCRAPE_QUALITY    = 200;
const TRANSLATE_CONCURRENCY = 16;

/**
 * Fetches QC photos and silently updates the DB after notifications are already sent.
 * Non-blocking — caller should not await this.
 */
async function enrichWithQcImages(products) {
  const toFetch = products.slice(0, MAX_QC_FETCHES);
  const updates = [];

  for (let i = 0; i < toFetch.length; i += QC_BATCH_SIZE) {
    const batch   = toFetch.slice(i, i + QC_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((p) => fetchQcImage(p.link)));
    results.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value) {
        updates.push({ ...toFetch[i + j], imagem: r.value });
      }
    });
  }

  if (!updates.length) return;

  // Single upsert for all QC updates — same IO footprint as the original insert
  const { error: qcErr } = await supabase
    .from('produtos_dealspro')
    .upsert(updates, { onConflict: 'id' });
  if (qcErr) logger.warn(`QC bulk update failed: ${qcErr.message}`);

  logger.info(`QC: updated ${updates.length} image(s) in one batch`);
}

export async function detectAndSaveNewProducts() {
  logger.info('Starting detection cycle');

  // 0. Housekeeping — não-fatal: falha de rede aqui não deve abortar o ciclo de scrape
  try {
    const deleted = await deleteOldProducts();
    if (deleted > 0) logger.info(`Deleted ${deleted} expired product(s)`);
  } catch (e) {
    logger.warn(`Housekeeping skipped (será refeito no próximo ciclo): ${e.message}`);
  }

  // 0b. Send delayed free Discord notifications for products now past visible_at
  try {
    await sendFreeDelayedNotifications();
    await notifyTelegramFreeFeed();
  } catch (e) {
    logger.warn(`Delayed notifications skipped: ${e.message}`);
  }

  // 1. Scrape all pages
  const scraped = await scrapeCssDeals();
  if (!scraped.length) {
    logger.warn('No products scraped — site may have blocked or changed layout');
    return [];
  }

  // 2. Attach hashes
  const withHashes = scraped.map((p) => ({
    ...p,
    hash: generateProductHash(p.nome, p.preco, p.link),
  }));

  // 3. Diff against DB + sync availability (marca esgotados / restaura restocados)
  let existingMap;
  try {
    existingMap = await getExistingHashMap();
    logger.info(`DB has ${existingMap.size} existing hashes`);
  } catch (e) {
    logger.error(`getExistingHashMap failed — abortando ciclo: ${e.message}`);
    return [];
  }

  // Links com imagem placeholder 800×900 = esgotado confirmado pelo CSSDeals
  const soldOutLinks = new Set(scraped.filter((p) => p.isSoldOut).map((p) => p.link));
  const scrapedLinks = new Set(withHashes.map((p) => p.link));

  if (soldOutLinks.size > 0) logger.info(`${soldOutLinks.size} produto(s) com placeholder 800×900 detectados como esgotados`);

  // Guarda de qualidade: scrapes muito pequenos indicam falha parcial — não marcar esgotados
  const scrapeOk = scraped.length >= MIN_SCRAPE_QUALITY;
  if (!scrapeOk) {
    logger.warn(`Scrape returned only ${scraped.length} products (< ${MIN_SCRAPE_QUALITY}) — skipping availability sync to avoid false sold-out marks`);
  }
  const { markedUnavailable, restored, restoredIds } = scrapeOk
    ? await syncAvailability(scrapedLinks, soldOutLinks).catch((e) => {
        logger.warn(`syncAvailability falhou (não-fatal): ${e.message}`);
        return { markedUnavailable: 0, restored: 0, restoredIds: [] };
      })
    : { markedUnavailable: 0, restored: 0, restoredIds: [] };
  if (markedUnavailable > 0) logger.info(`Marked ${markedUnavailable} product(s) as unavailable (esgotado)`);
  if (restored > 0) {
    logger.info(`Restored ${restored} product(s) to available (restocado)`);
    if (restoredIds.length) {
      const { data: restocked } = await supabase
        .from('produtos_dealspro')
        .select('*')
        .in('id', restoredIds);
      if (restocked?.length) await matchAndNotify(restocked, { isRestock: true });
    }
  }

  // Exclui produtos esgotados (placeholder 800×900) de "novos" — não notificar sobre item sem estoque
  const newItems      = withHashes.filter((p) => !existingMap.has(p.hash) && !p.isSoldOut);
  const existingItems = withHashes.filter((p) =>  existingMap.has(p.hash));
  logger.info(`Found ${newItems.length} new, ${existingItems.length} existing`);

  // 4. Merge sizes on existing products — in parallel
  await Promise.allSettled(
    existingItems
      .filter((p) => p.sizes?.length)
      .map((p) => {
        const existing = existingMap.get(p.hash);
        return mergeSizes(existing.id, existing.sizes, p.sizes).catch(
          (e) => logger.warn(`Size merge skipped: ${e.message}`),
        );
      }),
  );

  if (!newItems.length) return [];

  // 5. Enrich: translate + categorize in parallel batches (rate-limit safe per batch)
  const enriched = [];
  for (let i = 0; i < newItems.length; i += TRANSLATE_CONCURRENCY) {
    const batch   = newItems.slice(i, i + TRANSLATE_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (p) => {
        const nome_traduzido = await translateName(p.nome);
        const categoria      = categorize(p.nome, nome_traduzido);
        return { ...p, nome_traduzido, categoria };
      }),
    );
    enriched.push(...results);
  }

  // 6. Persist with visible_at = now + 30min (free delay)
  const visibleAt = new Date(Date.now() + FREE_DELAY_MS).toISOString();
  const rows = enriched.map((p) => ({
    nome:             p.nome,
    nome_traduzido:   p.nome_traduzido,
    preco:            p.preco,
    link:             p.link,
    imagem:           p.imagem,
    hash:             p.hash,
    categoria:        p.categoria,
    sizes:            p.sizes ?? [],
    cssdeals_item_id: p.cssdeals_item_id ?? null,
    visible_at:       visibleAt,
    free_notified:    false,
  }));

  let inserted;
  try {
    inserted = await insertProducts(rows);
    logger.success(`Saved ${inserted.length} new product(s) (visible to free at ${visibleAt})`);
  } catch (e) {
    logger.error(`insertProducts failed — abortando notificações: ${e.message}`);
    return [];
  }

  // 7. Premium webhook fires immediately — QC images update silently in background
  await dispatchNotifications(inserted).catch((e) => logger.warn(`dispatchNotifications falhou: ${e.message}`));
  await matchAndNotify(inserted).catch((e) => logger.warn(`matchAndNotify falhou: ${e.message}`));
  await notifyTelegramPremiumFeed(inserted).catch((e) => logger.warn(`telegramPremiumFeed falhou: ${e.message}`));
  await announceNewBatch(inserted.length, inserted.map((p) => p.categoria));

  // 8. Fetch QC images after notifications are already sent — non-blocking
  if (inserted.length > 0) {
    enrichWithQcImages(inserted).catch((e) => logger.warn(`QC enrichment failed: ${e.message}`));
  }

  return inserted;
}
