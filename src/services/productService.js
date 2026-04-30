import { scrapeCssDeals } from '../scraper/index.js';
import { getExistingHashes, insertProducts } from '../database/products.js';
import { generateProductHash } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import { dispatchNotifications } from '../notifications/index.js';

/**
 * Core pipeline: scrape → diff → persist → return new products.
 *
 * This is the single function the monitoring job calls on each tick.
 * Returns the list of newly inserted products (empty array if none).
 *
 * Phase 2 hook: after `newProducts` is populated, dispatch notifications here.
 */
export async function detectAndSaveNewProducts() {
  logger.info('Starting detection cycle');

  // 1. Scrape
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

  // 3. Load existing hashes from DB
  const existingHashes = await getExistingHashes();
  logger.info(`DB has ${existingHashes.size} existing hashes`);

  // 4. Filter to only new items
  const newItems = withHashes.filter((p) => !existingHashes.has(p.hash));
  logger.info(`Found ${newItems.length} new product(s)`);

  if (!newItems.length) return [];

  // 5. Persist
  const rows = newItems.map((p) => ({
    nome: p.nome,
    preco: p.preco,
    link: p.link,
    imagem: p.imagem,
    hash: p.hash,
    // categoria: null  ← Phase 2: AI classification
  }));

  const inserted = await insertProducts(rows);
  logger.success(`Saved ${inserted.length} new product(s)`);

  await dispatchNotifications(inserted);

  return inserted;
}
