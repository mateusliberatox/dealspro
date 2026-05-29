import { newPage } from './browser.js';
import { logger } from '../utils/logger.js';
import { parseSizes } from '../utils/sizes.js';
import type { ScrapedProduct, Category } from '../types.js';
import 'dotenv/config';

const BASE_URL = process.env.CSSDEALS_URL ?? 'https://cssdeals.com';

const FALLBACK_CATEGORIES: Category[] = [
  { name: 'Fashion',     id: 18 },
  { name: 'Shoes',       id: 11 },
  { name: 'Electronics', id: 19 },
  { name: 'Hat&Bags',    id: 26 },
  { name: 'Watches',     id: 20 },
];

const BATCH_SIZE     = 3;
const MAX_PAGES      = parseInt(process.env.SCRAPE_PAGES          ?? '2',  10);
const MAX_CATEGORIES = parseInt(process.env.SCRAPE_MAX_CATEGORIES ?? '12', 10);

const SLOW_CATEGORY_NAMES = new Set([
  'Cell phone', 'Audio & Video', 'sports goods',
  'Belt&Glasses', 'Computer accessories', 'perfume', 'suitcase',
]);

let _slowCategoryLastRun     = 0;
const SLOW_CATEGORY_INTERVAL = 60 * 60 * 1000;

interface RawProduct {
  nome:             string;
  preco:            string;
  link:             string;
  imagem:           string;
  skuText:          string;
  cssdeals_item_id: string | null;
  isSoldOut:        boolean;
}

async function extractProducts(page: import('playwright').Page, sourceLabel: string): Promise<ScrapedProduct[]> {
  const rawProducts = await page.evaluate<RawProduct[], string>((baseUrl) => {
    const results: RawProduct[] = [];
    const seen    = new Set<string>();
    const cards   = document.querySelectorAll('.mn-product-card');

    for (const card of cards) {
      const nameEl  = card.querySelector('.mn-product-detail h4 a, .mn-product-detail h5 a');
      const nome    = nameEl?.textContent?.trim() ?? '';
      const priceEl = card.querySelector('.mn-price-new') ?? card.querySelector('.mn-price');
      const preco   = priceEl?.textContent?.trim() ?? '';

      const linkEl  =
        card.querySelector('a.image[href*="itemid="]') ??
        card.querySelector('.mn-product-detail a[href*="itemid="]');
      const rawHref = linkEl?.getAttribute('href') ?? '';
      if (!rawHref || seen.has(rawHref)) continue;
      seen.add(rawHref);

      const link = rawHref.startsWith('http')
        ? rawHref
        : `${baseUrl}/${rawHref.replace(/^\//, '')}`;

      const imgEl  = card.querySelector('.mn-product-img img.main-img, .mn-product-img img');
      const imagem = (imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || '').replace(/\s+/g, '');
      const isSoldOut = /800.?x.?900|placeholder|skin\/img\/product\/\d+/i.test(imagem);

      const skuEl     = card.querySelector('.mn-sku');
      const skuText   = skuEl?.textContent?.trim() ?? '';
      const itemMatch = rawHref.match(/[?&]itemid=(\d+)/);
      const cssdeals_item_id = itemMatch ? itemMatch[1] : null;

      if (nome && link) results.push({ nome, preco, link, imagem, skuText, cssdeals_item_id, isSoldOut });
    }
    return results;
  }, BASE_URL);

  const products: ScrapedProduct[] = rawProducts.map(({ skuText, ...p }) => ({
    ...p,
    sizes:            parseSizes(skuText),
    cssdeals_item_id: p.cssdeals_item_id ?? null,
    isSoldOut:        p.isSoldOut ?? false,
  }));

  logger.info(`  ${sourceLabel}: ${products.length} products`);
  return products;
}

async function discoverCategories(page: import('playwright').Page): Promise<Category[]> {
  try {
    const categories = await page.evaluate<Category[]>(() => {
      const links   = document.querySelectorAll('a[href*="shop-left-sidebar.html?id="]');
      const seenIds   = new Set<number>();
      const seenNames = new Set<string>();
      const result: Array<{ name: string; id: number }> = [];

      for (const link of links) {
        const href  = link.getAttribute('href') ?? '';
        const match = href.match(/[?&]id=(\d+)/);
        if (!match) continue;

        const id = parseInt(match[1], 10);
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const name = link.textContent?.trim() || `Category-${id}`;
        if (seenNames.has(name)) continue;
        seenNames.add(name);

        result.push({ name, id });
      }
      return result;
    });

    if (categories.length > 0) {
      logger.info(`Discovered ${categories.length} categories from navigation`);
      return categories;
    }
  } catch (err: unknown) {
    logger.warn(`Category discovery error: ${(err as Error).message}`);
  }

  logger.warn('Falling back to hardcoded category list');
  return FALLBACK_CATEGORIES;
}

async function scrapeHomepage(): Promise<{ products: ScrapedProduct[]; categories: Category[] }> {
  const page = await newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('a[href*="itemid="]', { timeout: 20_000 });
    const products   = await extractProducts(page, 'Homepage');
    const categories = await discoverCategories(page);
    return { products, categories };
  } catch (err: unknown) {
    logger.warn(`Homepage scrape failed: ${(err as Error).message}`);
    return { products: [], categories: FALLBACK_CATEGORIES };
  } finally {
    await page.context().close();
  }
}

async function scrapeCategoryPage(categoryId: number, categoryName: string, pageNum: number): Promise<ScrapedProduct[]> {
  const url   = pageNum === 1
    ? `${BASE_URL}/shop-left-sidebar.html?id=${categoryId}`
    : `${BASE_URL}/shop-left-sidebar.html?id=${categoryId}&page=${pageNum}`;
  const label = pageNum > 1 ? `${categoryName} p${pageNum}` : categoryName;
  const page  = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('a[href*="itemid="]', { timeout: pageNum > 1 ? 10_000 : 20_000 });
    return await extractProducts(page, label);
  } catch (err: unknown) {
    if (pageNum > 1) logger.info(`  ${label}: sem produtos (última página ou timeout)`);
    else             logger.warn(`Category ${categoryName} scrape failed: ${(err as Error).message}`);
    return [];
  } finally {
    await page.context().close();
  }
}

async function scrapeCategory(categoryId: number, categoryName: string): Promise<ScrapedProduct[]> {
  const results = await Promise.allSettled(
    Array.from({ length: MAX_PAGES }, (_, i) =>
      scrapeCategoryPage(categoryId, categoryName, i + 1),
    ),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

let _categoryCache: { data: Category[] | null; ts: number } = { data: null, ts: 0 };
const CATEGORY_CACHE_TTL = 20 * 60 * 1000;

export async function scrapeCssDeals({ homepageOnly = false } = {}): Promise<ScrapedProduct[]> {
  logger.info(homepageOnly ? 'Starting fast homepage scrape...' : 'Starting multi-page scrape...');

  const result           = await scrapeHomepage();
  const homepageProducts = result.products;

  if (homepageOnly) {
    logger.success(`Homepage-only: ${homepageProducts.length} products`);
    return homepageProducts;
  }

  const now      = Date.now();
  const cacheHit = _categoryCache.data && (now - _categoryCache.ts) < CATEGORY_CACHE_TTL;
  let categories: Category[];

  if (cacheHit && _categoryCache.data) {
    categories = _categoryCache.data;
    logger.info(`Categories from cache (${categories.length})`);
  } else {
    categories     = result.categories.slice(0, MAX_CATEGORIES);
    _categoryCache = { data: categories, ts: now };
    if (result.categories.length > MAX_CATEGORIES) {
      logger.info(`Discovered ${result.categories.length} categories — limiting to ${MAX_CATEGORIES}`);
    }
  }

  const runSlowNow = (now - _slowCategoryLastRun) >= SLOW_CATEGORY_INTERVAL;
  const fastCats   = categories.filter((c) => !SLOW_CATEGORY_NAMES.has(c.name));
  const slowCats   = runSlowNow ? categories.filter((c) => SLOW_CATEGORY_NAMES.has(c.name)) : [];
  if (runSlowNow && slowCats.length) {
    _slowCategoryLastRun = now;
    logger.info(`Slow categories incluídas neste ciclo (${slowCats.length}): ${slowCats.map((c) => c.name).join(', ')}`);
  } else if (!runSlowNow) {
    logger.info(`Slow categories puladas — próxima em ${Math.ceil((SLOW_CATEGORY_INTERVAL - (now - _slowCategoryLastRun)) / 60_000)}min`);
  }

  const toScrape = [...fastCats, ...slowCats];
  const shuffled = [...toScrape].sort(() => Math.random() - 0.5);

  const allCategoryProducts: ScrapedProduct[] = [];
  const failedCats: Category[] = [];

  for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
    const batch        = shuffled.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((c) => scrapeCategory(c.id, c.name)),
    );
    for (let j = 0; j < batch.length; j++) {
      const r        = batchResults[j];
      const products = r.status === 'fulfilled' ? r.value : [];
      allCategoryProducts.push(...products);
      if (products.length === 0) failedCats.push(batch[j]);
    }
    if (i + BATCH_SIZE < shuffled.length) await new Promise((r) => setTimeout(r, 2000));
  }

  let toRetry = failedCats;
  for (let attempt = 1; attempt <= 2 && toRetry.length > 0; attempt++) {
    const delayMs = attempt === 1 ? 5_000 : 15_000;
    logger.info(`Retry ${attempt}/2: ${toRetry.length} categoria(s) — aguardando ${delayMs / 1000}s...`);
    await new Promise((r) => setTimeout(r, delayMs));
    const stillFailed: Category[] = [];
    for (let i = 0; i < toRetry.length; i += BATCH_SIZE) {
      const batch        = toRetry.slice(i, i + BATCH_SIZE);
      const retryResults = await Promise.allSettled(
        batch.map((c) => scrapeCategory(c.id, c.name)),
      );
      let recovered = 0;
      for (let j = 0; j < batch.length; j++) {
        const r        = retryResults[j];
        const products = r.status === 'fulfilled' ? r.value : [];
        allCategoryProducts.push(...products);
        if (products.length > 0) recovered++;
        else stillFailed.push(batch[j]);
      }
      if (recovered > 0) logger.info(`Retry ${attempt}/2: ${recovered}/${batch.length} categoria(s) recuperada(s)`);
      if (i + BATCH_SIZE < toRetry.length) await new Promise((r) => setTimeout(r, 2000));
    }
    toRetry = stillFailed;
  }

  const seen   = new Set<string>();
  const merged: ScrapedProduct[] = [];

  for (const product of homepageProducts) {
    if (!seen.has(product.link)) { seen.add(product.link); merged.push(product); }
  }
  for (const product of allCategoryProducts) {
    if (!seen.has(product.link)) { seen.add(product.link); merged.push(product); }
  }

  logger.success(`Total unique products scraped: ${merged.length} (homepage + ${toScrape.length} categories × até ${MAX_PAGES} páginas — ${slowCats.length} slow)`);
  return merged;
}

/** Visits a product detail page and returns the first QC photo URL. */
export async function fetchQcImage(detailUrl: string): Promise<string | null> {
  const page = await newPage();
  try {
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });

    const src = await page.evaluate<string | null>(() => {
      const img =
        document.querySelector('.single-slide .img-responsive') ??
        document.querySelector('.single-pro-img .img-responsive') ??
        document.querySelector('.mn-pro-img .img-responsive');
      return (img as HTMLImageElement | null)?.getAttribute('data-src') || (img as HTMLImageElement | null)?.src || null;
    });

    if (!src) return null;

    if (
      src.startsWith('data:') ||
      /placeholder|800.?x.?900|via\.placeholder|picsum|skin\/img\/product\/\d+/i.test(src) ||
      !/^https?:\/\/.+/.test(src)
    ) return null;

    return src.replace(
      /x-oss-process=image\/resize,w_\d+(\/quality,Q_\d+)?/,
      'x-oss-process=image/resize,w_800/quality,Q_80',
    );
  } catch { return null; }
  finally { await page.context().close(); }
}
