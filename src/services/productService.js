import { scrapeCssDeals } from '../scraper/index.js';
import { getExistingHashes, insertProducts } from '../database/products.js';
import { generateProductHash } from '../utils/hash.js';
import { translateName } from '../utils/translate.js';
import { categorize } from '../utils/categorize.js';
import { logger } from '../utils/logger.js';
import { dispatchNotifications } from '../notifications/index.js';

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

  // 3. Diff against DB
  const existingHashes = await getExistingHashes();
  logger.info(`DB has ${existingHashes.size} existing hashes`);

  const newItems = withHashes.filter((p) => !existingHashes.has(p.hash));
  logger.info(`Found ${newItems.length} new product(s)`);
  if (!newItems.length) return [];

  // 4. Enrich: translate + categorize
  logger.info('Translating and categorizing new products...');
  const enriched = await Promise.all(
    newItems.map(async (p) => {
      const nome_traduzido = await translateName(p.nome);
      const categoria = categorize(p.nome, nome_traduzido);
      return { ...p, nome_traduzido, categoria };
    }),
  );

  // 5. Persist
  const rows = enriched.map((p) => ({
    nome: p.nome,
    nome_traduzido: p.nome_traduzido,
    preco: p.preco,
    link: p.link,
    imagem: p.imagem,
    hash: p.hash,
    categoria: p.categoria,
  }));

  const inserted = await insertProducts(rows);
  logger.success(`Saved ${inserted.length} new product(s)`);

  await dispatchNotifications(inserted);
  return inserted;
}
