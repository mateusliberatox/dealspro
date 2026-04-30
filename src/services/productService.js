import { scrapeCssDeals } from '../scraper/index.js';
import { getExistingHashMap, insertProducts, mergeSizes, deleteOldProducts } from '../database/products.js';
import { generateProductHash } from '../utils/hash.js';
import { translateName } from '../utils/translate.js';
import { categorize } from '../utils/categorize.js';
import { logger } from '../utils/logger.js';
import { dispatchNotifications } from '../notifications/index.js';
import { matchAndNotify } from '../notifications/alertService.js';

export async function detectAndSaveNewProducts() {
  logger.info('Starting detection cycle');

  // 0. Housekeeping — remove products older than 5 days
  const deleted = await deleteOldProducts();
  if (deleted > 0) logger.info(`Deleted ${deleted} expired product(s)`);

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

  // 3. Diff against DB
  const existingMap = await getExistingHashMap();
  logger.info(`DB has ${existingMap.size} existing hashes`);

  const newItems      = withHashes.filter((p) => !existingMap.has(p.hash));
  const existingItems = withHashes.filter((p) =>  existingMap.has(p.hash));
  logger.info(`Found ${newItems.length} new, ${existingItems.length} existing`);

  // 4. Merge sizes on existing products (no re-insert, no duplicate)
  for (const p of existingItems) {
    if (!p.sizes?.length) continue;
    const existing = existingMap.get(p.hash);
    await mergeSizes(existing.id, existing.sizes, p.sizes).catch((e) =>
      logger.warn(`Size merge skipped: ${e.message}`),
    );
  }

  if (!newItems.length) return [];

  // 5. Enrich new items: translate + categorize
  logger.info('Translating and categorizing new products...');
  const enriched = await Promise.all(
    newItems.map(async (p) => {
      const nome_traduzido = await translateName(p.nome);
      const categoria = categorize(p.nome, nome_traduzido);
      return { ...p, nome_traduzido, categoria };
    }),
  );

  // 6. Persist
  const rows = enriched.map((p) => ({
    nome: p.nome,
    nome_traduzido: p.nome_traduzido,
    preco: p.preco,
    link: p.link,
    imagem: p.imagem,
    hash: p.hash,
    categoria: p.categoria,
    sizes: p.sizes ?? [],
  }));

  const inserted = await insertProducts(rows);
  logger.success(`Saved ${inserted.length} new product(s)`);

  // 7. Channel webhook + premium alert DMs
  await dispatchNotifications(inserted);
  await matchAndNotify(inserted);

  return inserted;
}
