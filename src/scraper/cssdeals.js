import { newPage } from './browser.js';
import { logger } from '../utils/logger.js';
import { parseSizes } from '../utils/sizes.js';
import 'dotenv/config';

const BASE_URL = process.env.CSSDEALS_URL ?? 'https://cssdeals.com';

/**
 * Fallback used when dynamic category discovery fails.
 * Keep this in sync with any known category IDs.
 */
const FALLBACK_CATEGORIES = [
  { name: 'Fashion',     id: 18 },
  { name: 'Shoes',       id: 11 },
  { name: 'Electronics', id: 19 },
  { name: 'Hat&Bags',    id: 26 },
  { name: 'Watches',     id: 20 },
];

const BATCH_SIZE      = 3;  // max concurrent Playwright contexts
const MAX_PAGES       = parseInt(process.env.SCRAPE_PAGES          ?? '2',  10);
const MAX_CATEGORIES  = parseInt(process.env.SCRAPE_MAX_CATEGORIES ?? '12', 10);

// Categorias que frequentemente fazem timeout — rodadas só 1×/hora para não atrasar o ciclo normal
const SLOW_CATEGORY_NAMES = new Set([
  'Cell phone', 'Audio & Video', 'sports goods',
  'Belt&Glasses', 'Computer accessories', 'perfume', 'suitcase',
]);

let _slowCategoryLastRun    = 0;
const SLOW_CATEGORY_INTERVAL = 60 * 60 * 1000; // 1 hora

/**
 * Extracts product cards from whatever cssdeals listing page is already loaded.
 * Works for both the homepage carousel and category pages.
 */
async function extractProducts(page, sourceLabel) {
  const rawProducts = await page.evaluate((baseUrl) => {
    const results = [];
    const seen = new Set();
    const cards = document.querySelectorAll('.mn-product-card');

    for (const card of cards) {
      const nameEl = card.querySelector('.mn-product-detail h4 a, .mn-product-detail h5 a');
      const nome = nameEl?.textContent?.trim() ?? '';

      const priceEl = card.querySelector('.mn-price-new') ?? card.querySelector('.mn-price');
      const preco = priceEl?.textContent?.trim() ?? '';

      const linkEl =
        card.querySelector('a.image[href*="itemid="]') ??
        card.querySelector('.mn-product-detail a[href*="itemid="]');
      const rawHref = linkEl?.getAttribute('href') ?? '';
      if (!rawHref || seen.has(rawHref)) continue;
      seen.add(rawHref);

      const link = rawHref.startsWith('http')
        ? rawHref
        : `${baseUrl}/${rawHref.replace(/^\//, '')}`;

      const imgEl = card.querySelector('.mn-product-img img.main-img, .mn-product-img img');
      // CSSDeals usa lazy-load: data-src contém a URL real; src é placeholder de carregamento
      const imagem = (imgEl?.getAttribute('data-src') || imgEl?.getAttribute('src') || '').replace(/\s+/g, '');

      // Detecta esgotados: placeholder 800×900 OU lazy-load genérico do CSSDeals (skin/img/product/N.jpg)
      const isSoldOut = /800.?x.?900|placeholder|skin\/img\/product\/\d+/i.test(imagem);

      const skuEl = card.querySelector('.mn-sku');
      const skuText = skuEl?.textContent?.trim() ?? '';

      const itemMatch = rawHref.match(/[?&]itemid=(\d+)/);
      const cssdeals_item_id = itemMatch ? itemMatch[1] : null; // string evita perda de precisão em IDs > 2^53

      if (nome && link) results.push({ nome, preco, link, imagem, skuText, cssdeals_item_id, isSoldOut });
    }

    return results;
  }, BASE_URL);

  const products = rawProducts.map(({ skuText, ...p }) => ({
    ...p,
    sizes:            parseSizes(skuText),
    cssdeals_item_id: p.cssdeals_item_id ?? null,
    isSoldOut:        p.isSoldOut ?? false,
  }));

  logger.info(`  ${sourceLabel}: ${products.length} products`);
  return products;
}

/**
 * Extracts all category links from the navigation of the already-loaded page.
 * Falls back to FALLBACK_CATEGORIES if nothing is found.
 */
async function discoverCategories(page) {
  try {
    const categories = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="shop-left-sidebar.html?id="]');
      const seenIds   = new Set();
      const seenNames = new Set();
      const result = [];

      for (const link of links) {
        const href = link.getAttribute('href') ?? '';
        const match = href.match(/[?&]id=(\d+)/);
        if (!match) continue;

        const id = parseInt(match[1], 10);
        if (seenIds.has(id)) continue;
        seenIds.add(id);

        const name = link.textContent?.trim() || `Category-${id}`;
        // CSSDeals pode listar a mesma categoria com dois IDs diferentes (ex: "sports goods").
        // Deduplica por nome para evitar scraping duplo e logs enganosos.
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
  } catch (err) {
    logger.warn(`Category discovery error: ${err.message}`);
  }

  logger.warn('Falling back to hardcoded category list');
  return FALLBACK_CATEGORIES;
}

/**
 * Scrapes the homepage carousel and discovers all category links from the nav.
 */
async function scrapeHomepage() {
  const page = await newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('a[href*="itemid="]', { timeout: 20_000 });
    const products   = await extractProducts(page, 'Homepage');
    const categories = await discoverCategories(page);
    return { products, categories };
  } catch (err) {
    logger.warn(`Homepage scrape failed: ${err.message}`);
    return { products: [], categories: FALLBACK_CATEGORIES };
  } finally {
    await page.context().close();
  }
}

/**
 * Scrapes a single page of a category listing.
 * Returns [] if the page has no products (signals last page).
 */
async function scrapeCategoryPage(categoryId, categoryName, pageNum) {
  const url = pageNum === 1
    ? `${BASE_URL}/shop-left-sidebar.html?id=${categoryId}`
    : `${BASE_URL}/shop-left-sidebar.html?id=${categoryId}&page=${pageNum}`;
  const label = pageNum > 1 ? `${categoryName} p${pageNum}` : categoryName;
  const page  = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForSelector('a[href*="itemid="]', { timeout: pageNum > 1 ? 10_000 : 20_000 });
    return await extractProducts(page, label);
  } catch (err) {
    if (pageNum > 1) {
      logger.info(`  ${label}: sem produtos (última página ou timeout)`);
    } else {
      logger.warn(`Category ${categoryName} scrape failed: ${err.message}`);
    }
    return [];
  } finally {
    await page.context().close();
  }
}

/**
 * Scrapes up to MAX_PAGES pages of a category in parallel.
 * Parallel pages reduzem o tempo por categoria de (p1+p2) para max(p1,p2).
 */
async function scrapeCategory(categoryId, categoryName) {
  const results = await Promise.allSettled(
    Array.from({ length: MAX_PAGES }, (_, i) =>
      scrapeCategoryPage(categoryId, categoryName, i + 1),
    ),
  );
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

// Cache de categorias em memória — beneficia o Railway (processo persistente).
// No GitHub Actions cada run é um processo novo, então o cache nunca aquece.
let _categoryCache = { data: null, ts: 0 };
const CATEGORY_CACHE_TTL = 20 * 60 * 1000; // 20 min

/**
 * Main scraper: homepage + all category pages (discovered dynamically) in batches.
 * Returns deduplicated list by link.
 *
 * No Railway (processo persistente), pula a homepage depois do primeiro ciclo e usa
 * categorias em cache — economiza ~15s por ciclo durante os 20min de TTL.
 */
export async function scrapeCssDeals({ homepageOnly = false } = {}) {
  logger.info(homepageOnly ? 'Starting fast homepage scrape...' : 'Starting multi-page scrape...');

  const result         = await scrapeHomepage();
  const homepageProducts = result.products;

  if (homepageOnly) {
    logger.success(`Homepage-only: ${homepageProducts.length} products`);
    return homepageProducts;
  }

  const now      = Date.now();
  const cacheHit = _categoryCache.data && (now - _categoryCache.ts) < CATEGORY_CACHE_TTL;
  let categories;

  if (cacheHit) {
    categories = _categoryCache.data;
    logger.info(`Categories from cache (${categories.length})`);
  } else {
    categories     = result.categories.slice(0, MAX_CATEGORIES);
    _categoryCache = { data: categories, ts: now };
    if (result.categories.length > MAX_CATEGORIES) {
      logger.info(`Discovered ${result.categories.length} categories — limiting to ${MAX_CATEGORIES}`);
    }
  }

  // Separa categorias lentas (timeout frequente) — só incluídas 1×/hora
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

  // Embaralha a ordem a cada ciclo: evita que o Cloudflare aprenda quais
  // categorias chegam juntas e bloqueie sempre os mesmos batches.
  const shuffled = [...toScrape].sort(() => Math.random() - 0.5);

  const allCategoryProducts = [];
  const failedCats          = [];

  for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
    const batch = shuffled.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((c) => scrapeCategory(c.id, c.name)),
    );
    for (let j = 0; j < batch.length; j++) {
      const products = batchResults[j].status === 'fulfilled' ? batchResults[j].value : [];
      allCategoryProducts.push(...products);
      if (products.length === 0) failedCats.push(batch[j]);
    }
    // Pausa entre batches para o rate limiter do Cloudflare resetar
    if (i + BATCH_SIZE < shuffled.length) await new Promise((r) => setTimeout(r, 2000));
  }

  // Até 2 tentativas para recuperar categorias com timeout (Cloudflare rate-limit)
  // 1ª tentativa: 5s de espera · 2ª tentativa: 15s de espera
  let toRetry = failedCats;
  for (let attempt = 1; attempt <= 2 && toRetry.length > 0; attempt++) {
    const delayMs = attempt === 1 ? 5_000 : 15_000;
    logger.info(`Retry ${attempt}/2: ${toRetry.length} categoria(s) — aguardando ${delayMs / 1000}s...`);
    await new Promise((r) => setTimeout(r, delayMs));
    const stillFailed = [];
    for (let i = 0; i < toRetry.length; i += BATCH_SIZE) {
      const batch = toRetry.slice(i, i + BATCH_SIZE);
      const retryResults = await Promise.allSettled(
        batch.map((c) => scrapeCategory(c.id, c.name)),
      );
      let recovered = 0;
      for (let j = 0; j < batch.length; j++) {
        const products = retryResults[j].status === 'fulfilled' ? retryResults[j].value : [];
        allCategoryProducts.push(...products);
        if (products.length > 0) recovered++;
        else stillFailed.push(batch[j]);
      }
      if (recovered > 0) logger.info(`Retry ${attempt}/2: ${recovered}/${batch.length} categoria(s) recuperada(s)`);
      if (i + BATCH_SIZE < toRetry.length) await new Promise((r) => setTimeout(r, 2000));
    }
    toRetry = stillFailed;
  }

  // Merge and deduplicate by link
  const seen   = new Set();
  const merged = [];

  for (const product of homepageProducts) {
    if (!seen.has(product.link)) {
      seen.add(product.link);
      merged.push(product);
    }
  }

  for (const product of allCategoryProducts) {
    if (!seen.has(product.link)) {
      seen.add(product.link);
      merged.push(product);
    }
  }

  logger.success(`Total unique products scraped: ${merged.length} (homepage + ${toScrape.length} categories × até ${MAX_PAGES} páginas — ${slowCats.length} slow)`);
  return merged;
}

/**
 * Visits a product detail page and returns the first QC photo URL.
 */
export async function fetchQcImage(detailUrl) {
  const page = await newPage();
  try {
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });

    const src = await page.evaluate(() => {
      const img =
        document.querySelector('.single-slide .img-responsive') ??
        document.querySelector('.single-pro-img .img-responsive') ??
        document.querySelector('.mn-pro-img .img-responsive');
      // data-src tem a URL real em páginas com lazy-load; src pode ser placeholder
      return img?.getAttribute('data-src') || img?.src || null;
    });

    if (!src) return null;

    // Rejeita placeholders: 800×900, lazy-load genérico do CSSDeals e data URIs
    if (
      src.startsWith('data:') ||
      /placeholder|800.?x.?900|via\.placeholder|picsum|skin\/img\/product\/\d+/i.test(src) ||
      !/^https?:\/\/.+/.test(src)
    ) return null;

    return src.replace(
      /x-oss-process=image\/resize,w_\d+(\/quality,Q_\d+)?/,
      'x-oss-process=image/resize,w_800/quality,Q_80',
    );
  } catch {
    return null;
  } finally {
    await page.context().close();
  }
}

