import { newPage } from './browser.js';
import { logger } from '../utils/logger.js';
import { parseSizes } from '../utils/sizes.js';
import 'dotenv/config';

const BASE_URL = process.env.CSSDEALS_URL ?? 'https://cssdeals.com';

/**
 * Category pages to scrape in addition to the homepage.
 * Each page 1 shows the most recent products (sorted by position/itemid desc).
 * Only the categories with highest product velocity are included to keep
 * each run under ~3 minutes total.
 */
const CATEGORY_PAGES = [
  { name: 'Fashion',     id: 18 },
  { name: 'Shoes',       id: 11 },
  { name: 'Electronics', id: 19 },
  { name: 'Hat&Bags',    id: 26 },
  { name: 'Watches',     id: 20 },
];

const BATCH_SIZE = 3; // max concurrent Playwright contexts

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

      const skuEl = card.querySelector('.mn-sku');
      const skuText = skuEl?.textContent?.trim() ?? '';

      if (nome && link) results.push({ nome, preco, link, imagem, skuText });
    }

    return results;
  }, BASE_URL);

  const products = rawProducts.map(({ skuText, ...p }) => ({
    ...p,
    sizes: parseSizes(skuText),
  }));

  logger.info(`  ${sourceLabel}: ${products.length} products`);
  return products;
}

/**
 * Scrapes the homepage carousel.
 */
async function scrapeHomepage() {
  const page = await newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForSelector('a[href*="itemid="]', { timeout: 35_000 });
    return await extractProducts(page, 'Homepage');
  } catch (err) {
    logger.warn(`Homepage scrape failed: ${err.message}`);
    return [];
  } finally {
    await page.context().close();
  }
}

/**
 * Scrapes page 1 of a category (shows newest products first).
 */
async function scrapeCategory(categoryId, categoryName) {
  const url = `${BASE_URL}/shop-left-sidebar.html?id=${categoryId}`;
  const page = await newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    await page.waitForSelector('a[href*="itemid="]', { timeout: 30_000 });
    return await extractProducts(page, categoryName);
  } catch (err) {
    logger.warn(`Category ${categoryName} scrape failed: ${err.message}`);
    return [];
  } finally {
    await page.context().close();
  }
}

/**
 * Main scraper: homepage + all category pages in parallel batches.
 * Returns deduplicated list by link.
 */
export async function scrapeCssDeals() {
  logger.info('Starting multi-page scrape...');

  // Homepage first, then categories in batches to control memory/time
  const homepageResult = await Promise.allSettled([scrapeHomepage()]);

  const categoryResults = [];
  for (let i = 0; i < CATEGORY_PAGES.length; i += BATCH_SIZE) {
    const batch = CATEGORY_PAGES.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map((c) => scrapeCategory(c.id, c.name)),
    );
    categoryResults.push(...batchResults);
  }

  const results = [...homepageResult, ...categoryResults];

  // Merge and deduplicate by link
  const seen = new Set();
  const merged = [];

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const product of result.value) {
      if (!seen.has(product.link)) {
        seen.add(product.link);
        merged.push(product);
      }
    }
  }

  logger.success(`Total unique products scraped: ${merged.length} (from ${tasks.length} pages)`);
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
