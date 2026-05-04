import { scrapeCssDeals, fetchQcImage } from '../scraper/index.js';
import { getExistingHashMap, insertProducts, mergeSizes, deleteOldProducts } from '../database/products.js';
import { generateProductHash } from '../utils/hash.js';
import { translateName } from '../utils/translate.js';
import { categorize } from '../utils/categorize.js';
import { logger } from '../utils/logger.js';
import { dispatchNotifications } from '../notifications/index.js';
import { matchAndNotify } from '../notifications/alertService.js';
import { sendFreeDelayedNotifications } from '../notifications/discord.js';
import { supabase } from '../database/supabase.js';

const MAX_QC_FETCHES   = 8;
const FREE_DELAY_MS    = 30 * 60 * 1000; // 30 minutes

export async function detectAndSaveNewProducts() {
  logger.info('Starting detection cycle');

  // 0. Housekeeping
  const deleted = await deleteOldProducts();
  if (deleted > 0) logger.info(`Deleted ${deleted} expired product(s)`);

  // 0b. Send delayed free Discord notifications for products now past visible_at
  await sendFreeDelayedNotifications();

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

  // 3. Diff against DB
  const existingMap = await getExistingHashMap();
  logger.info(`DB has ${existingMap.size} existing hashes`);

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

  // 5. Enrich: translate + categorize + QC image (capped)
  const qcEligible = newItems.length <= MAX_QC_FETCHES;
  if (!qcEligible) logger.info(`${newItems.length} new products — skipping QC (bulk import)`);

  const enriched = [];
  for (const p of newItems) {
    const nome_traduzido = await translateName(p.nome);
    const categoria      = categorize(p.nome, nome_traduzido);

    let imagem = p.imagem;
    if (qcEligible) {
      const qc = await fetchQcImage(p.link);
      if (qc) imagem = qc;
      await new Promise((r) => setTimeout(r, 400));
    }

    enriched.push({ ...p, nome_traduzido, categoria, imagem });
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

  return inserted;
}
