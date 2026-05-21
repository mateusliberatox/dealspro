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

const BATCH_SIZE      = 7;  // max concurrent Playwright contexts
const MAX_PAGES       = parseInt(process.env.SCRAPE_PAGES          ?? '2',  10);
const MAX_CATEGORIES  = parseInt(process.env.SCRAPE_MAX_CATEGORIES ?? '12', 10);

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
      const imagem = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';

      // Produtos com imagem placeholder 800×900 estão esgotados no CSSDeals
      const isSoldOut = /800.?x.?900|placeholder/i.test(imagem);

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
      const seen = new Set();
      const result = [];

      for (const link of links) {
        const href = link.getAttribute('href') ?? '';
        const match = href.match(/[?&]id=(\d+)/);
        if (!match) continue;

        const id = parseInt(match[1], 10);
        if (seen.has(id)) continue;
        seen.add(id);

        const name = link.textContent?.trim() || `Category-${id}`;
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
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForSelector('a[href*="itemid="]', { timeout: 35_000 });
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
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForSelector('a[href*="itemid="]', { timeout: pageNum > 1 ? 15_000 : 30_000 });
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
 * Scrapes up to MAX_PAGES pages of a category, stopping early if a page is empty.
 */
async function scrapeCategory(categoryId, categoryName) {
  const all = [];
  for (let p = 1; p <= MAX_PAGES; p++) {
    const products = await scrapeCategoryPage(categoryId, categoryName, p);
    all.push(...products);
    if (products.length === 0) break; // no more pages
  }
  return all;
}

/**
 * Main scraper: homepage + all category pages (discovered dynamically) in batches.
 * Returns deduplicated list by link.
 */
export async function scrapeCssDeals() {
  logger.info('Starting multi-page scrape...');

  // Homepage loads first — products + category discovery happen in the same page load
  const { products: homepageProducts, categories: discovered } = await scrapeHomepage();
  const categories = discovered.slice(0, MAX_CATEGORIES);
  if (discovered.length > MAX_CATEGORIES) {
    logger.info(`Discovered ${discovered.length} categories — limiting to ${MAX_CATEGORIES}`);
  }

  const categoryResults = [];
  for (let i = 0; i < categories.length; i += BATCH_SIZE) {
    const batch = categories.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((c) => scrapeCategory(c.id, c.name)),
    );
    categoryResults.push(...batchResults);
  }

  // Merge and deduplicate by link
  const seen = new Set();
  const merged = [];

  for (const product of homepageProducts) {
    if (!seen.has(product.link)) {
      seen.add(product.link);
      merged.push(product);
    }
  }

  for (const result of categoryResults) {
    if (result.status !== 'fulfilled') continue;
    for (const product of result.value) {
      if (!seen.has(product.link)) {
        seen.add(product.link);
        merged.push(product);
      }
    }
  }

  logger.success(`Total unique products scraped: ${merged.length} (homepage + ${categories.length} categories × até ${MAX_PAGES} páginas)`);
  return merged;
}

/**
 * Visits a product detail page and returns the first QC photo URL.
 */
export async function fetchQcImage(detailUrl) {
  const page = await newPage();
  try {
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1500);

    const src = await page.evaluate(() => {
      const img =
        document.querySelector('.single-slide .img-responsive') ??
        document.querySelector('.single-pro-img .img-responsive') ??
        document.querySelector('.mn-pro-img .img-responsive');
      return img?.src ?? null;
    });

    if (!src) return null;

    // Rejeita placeholders (produto esgotado mostra imagem genérica)
    if (
      src.startsWith('data:') ||
      /placeholder|800.?x.?900|via\.placeholder|picsum/i.test(src) ||
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

export async function scrapeSelectors() {
  const page = await newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForTimeout(3000);
    const info = await page.evaluate(() => {
      const allClasses = new Set();
      document.querySelectorAll('*').forEach((el) => el.classList.forEach((c) => allClasses.add(c)));
      const bodies = [...document.querySelectorAll('.mn-product-card')]
        .slice(0, 3).map((el) => el.outerHTML.slice(0, 1200));
      return { classes: [...allClasses], bodies };
    });
    console.log('\n=== CLASS LIST ===');
    console.log(info.classes.filter((c) => /product|deal|card|item|price|title|sku|size/i.test(c)).join('\n'));
    info.bodies.forEach((b, i) => console.log(`\n--- Element ${i + 1} ---\n${b}`));
  } finally {
    await page.context().close();
  }
}
