import { newPage } from './browser.js';
import { logger } from '../utils/logger.js';
import { parseSizes } from '../utils/sizes.js';
import 'dotenv/config';

const BASE_URL = process.env.CSSDEALS_URL ?? 'https://cssdeals.com';

/**
 * Scrapes the cssdeals.com homepage.
 * Returns: Array<{ nome, preco, link, imagem, sizes }>
 *
 * Confirmed selectors:
 *   Container:  .mn-product-card
 *   Name:       .mn-product-detail h4/h5 a
 *   Price:      .mn-price-new, .mn-price
 *   Link:       a.image[href*="itemid="]
 *   Image:      .mn-product-img img.main-img
 *   SKU/sizes:  .mn-sku  (variant text, parsed for size tokens)
 */
export async function scrapeCssDeals() {
  const page = await newPage();

  try {
    logger.info(`Navigating to ${BASE_URL}`);
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    // Wait for real products (loaded via AJAX after DOM is ready)
    await page.waitForSelector('a[href*="itemid="]', { timeout: 35_000 });

    const rawProducts = await page.evaluate((baseUrl) => {
      const results = [];
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
        if (!rawHref) continue;

        const link = rawHref.startsWith('http')
          ? rawHref
          : `${baseUrl}/${rawHref.replace(/^\//, '')}`;

        const imgEl = card.querySelector('.mn-product-img img.main-img, .mn-product-img img');
        const imagem = imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || '';

        // SKU/variant text — parsed server-side for sizes
        const skuEl = card.querySelector('.mn-sku');
        const skuText = skuEl?.textContent?.trim() ?? '';

        if (nome && link) results.push({ nome, preco, link, imagem, skuText });
      }

      return results;
    }, BASE_URL);

    // Parse sizes from skuText (runs in Node, not browser)
    const products = rawProducts.map(({ skuText, ...p }) => ({
      ...p,
      sizes: parseSizes(skuText),
    }));

    logger.success(`Scraped ${products.length} products from cssdeals.com`);
    return products;
  } catch (err) {
    logger.error('Scrape failed', { message: err.message });
    throw err;
  } finally {
    await page.context().close();
  }
}

/**
 * Visits a product detail page and returns the first QC photo URL.
 * QC photos are real pictures taken by buyers of the received product.
 * Returns null if the page fails or no QC image is found.
 */
export async function fetchQcImage(detailUrl) {
  const page = await newPage();
  try {
    await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1500); // let AJAX populate gallery

    const src = await page.evaluate(() => {
      // First image inside the product gallery (slick slider)
      const img =
        document.querySelector('.single-slide .img-responsive') ??
        document.querySelector('.single-pro-img .img-responsive') ??
        document.querySelector('.mn-pro-img .img-responsive');
      return img?.src ?? null;
    });

    if (!src) return null;

    // Upgrade to a reasonable quality (800px wide, Q_80)
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
      document.querySelectorAll('*').forEach((el) => {
        el.classList.forEach((c) => allClasses.add(c));
      });
      const bodies = [...document.querySelectorAll('.mn-product-card')]
        .slice(0, 3)
        .map((el) => el.outerHTML.slice(0, 1200));
      return { classes: [...allClasses], bodies };
    });

    console.log('\n=== CLASS LIST (filtered) ===');
    console.log(info.classes.filter((c) => /product|deal|card|item|price|title|sku|size/i.test(c)).join('\n'));
    console.log('\n=== SAMPLE HTML ===');
    info.bodies.forEach((b, i) => console.log(`\n--- Element ${i + 1} ---\n${b}`));
  } finally {
    await page.context().close();
  }
}
