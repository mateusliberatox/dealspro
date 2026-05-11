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

const MAX_QC_FETCHES   = 100; // tenta QC para todos os produtos novos
const QC_BATCH_SIZE    = 3;   // parallel QC fetches
const FREE_DELAY_MS    = 30 * 60 * 1000; // 30 minutes
// Scrapes com menos produtos que este mínimo são tratados como falha parcial
// e não disparam syncAvailability para evitar falsos positivos de "esgotado"
const MIN_SCRAPE_QUALITY = 40;

export async function detectAndSaveNewProducts() {
  logger.info('Starting detection cycle');

  // 0. Housekeeping
  const deleted = await deleteOldProducts();
  if (deleted > 0) logger.info(`Deleted ${deleted} expired product(s)`);

  // 0b. Send delayed free Discord notifications for products now past visible_at
  await sendFreeDelayedNotifications();
  await notifyTelegramFreeFeed();

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
  const existingMap = await getExistingHashMap();
  logger.info(`DB has ${existingMap.size} existing hashes`);

  const scrapedLinks = new Set(withHashes.map((p) => p.link));

  // Guarda de qualidade: scrapes muito pequenos indicam falha parcial — não marcar esgotados
  const scrapeOk = scraped.length >= MIN_SCRAPE_QUALITY;
  if (!scrapeOk) {
    logger.warn(`Scrape returned only ${scraped.length} products (< ${MIN_SCRAPE_QUALITY}) — skipping availability sync to avoid false sold-out marks`);
  }
  const { markedUnavailable, restored, restoredIds } = scrapeOk
    ? await syncAvailability(scrapedLinks)
    : { markedUnavailable: 0, restored: 0, restoredIds: [] };
  if (markedUnavailable > 0) logger.info(`Marked ${markedUnavailable} product(s) as unavailable (esgotado)`);
  if (restored > 0) {
    logger.info(`Restored ${restored} product(s) to available (restocado)`);
    // Notifica usuários premium com alertas que correspondem aos produtos restocados
    if (restoredIds.length) {
      const { data: restocked } = await supabase
        .from('produtos_dealspro')
        .select('*')
        .in('id', restoredIds);
      if (restocked?.length) await matchAndNotify(restocked, { isRestock: true });
    }
  }

  const newItems      = withHashes.filter((p) => !existingMap.has(p.hash));
  const existingItems = withHashes.filter((p) =>  existingMap.has(p.hash));
  logger.info(`Found ${newItems.length} new, ${existingItems.length} existing`);

  // 4. Merge sizes on existing products
  for (const p of existingItems) {
    if (!p.sizes?.length) continue;
    const existing = existingMap.get(p.hash);
    await mergeSizes(existing.id, existing.sizes, p.sizes).catch((e) =>
      logger.warn(`Size merge skipped: ${e.message}`),
    );
  }

  if (!newItems.length) return [];

  // 5. Enrich: translate + categorize (sequential) + QC image (parallel batches)
  if (newItems.length > MAX_QC_FETCHES) {
    logger.info(`${newItems.length} new products — QC fetching first ${MAX_QC_FETCHES}`);
  }

  // 5a. Translate + categorize sequentially (rate-limit safe)
  const enriched = [];
  for (const p of newItems) {
    const nome_traduzido = await translateName(p.nome);
    const categoria      = categorize(p.nome, nome_traduzido);
    enriched.push({ ...p, nome_traduzido, categoria });
  }

  // 5b. QC images in parallel batches — replaces listing image with buyer QC photo
  const toFetchQC = enriched.slice(0, MAX_QC_FETCHES);
  for (let i = 0; i < toFetchQC.length; i += QC_BATCH_SIZE) {
    const batch   = toFetchQC.slice(i, i + QC_BATCH_SIZE);
    const results = await Promise.allSettled(batch.map((p) => fetchQcImage(p.link)));
    results.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value) toFetchQC[i + j].imagem = r.value;
    });
  }

  // 6. Persist with visible_at = now + 30min (free delay)
  const visibleAt = new Date(Date.now() + FREE_DELAY_MS).toISOString();
  const rows = enriched.map((p) => ({
    nome:           p.nome,
    nome_traduzido: p.nome_traduzido,
    preco:          p.preco,
    link:           p.link,
    imagem:         p.imagem,
    hash:           p.hash,
    categoria:      p.categoria,
    sizes:          p.sizes ?? [],
    visible_at:     visibleAt,
    free_notified:  false,
  }));

  const inserted = await insertProducts(rows);
  logger.success(`Saved ${inserted.length} new product(s) (visible to free at ${visibleAt})`);

  // 7. Premium webhook fires immediately; free webhook fires after visible_at (handled in next cycles)
  await dispatchNotifications(inserted);
  await matchAndNotify(inserted);
  await notifyTelegramPremiumFeed(inserted);
  await announceNewBatch(inserted.length, inserted.map((p) => p.categoria));

  return inserted;
}
