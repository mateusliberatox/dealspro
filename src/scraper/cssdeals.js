import { newPage } from './browser.js';
import { logger } from '../utils/logger.js';
import 'dotenv/config';

const BASE_URL = process.env.CSSDEALS_URL ?? 'https://cssdeals.com';

/**
 * Scrapes the cssdeals.com homepage and returns a raw list of products.
 * Returns: Array<{ nome, preco, link, imagem }>
 *
 * Selectors confirmed via scrapeSelectors():
 *   - Container: .mn-product-card
 *   - Name:      .mn-title or .mn-title-2
 *   - Price:     .mn-price-new (current), .mn-price-old (crossed out)
 *   - Image:     .mn-product-img img
 *   - Link:      .mn-product-card > a (wraps the card)
 */
export async function scrapeCssDeals() {
  const page = await newPage();

  try {
    logger.info(`Navigating to ${BASE_URL}`);
    // networkidle ensures the AJAX calls that populate real products have completed
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 45_000 });

    // Wait for a real product link to be present (itemid= distinguishes real from demo cards)
    await page.waitForSelector('a[href*="itemid="]', { timeout: 20_000 });

    const products = await page.evaluate((baseUrl) => {
      const results = [];

      const cards = document.querySelectorAll('.mn-product-card');

      for (const card of cards) {
        // Name is inside h4/h5 > a inside .mn-product-detail
        const nameEl = card.querySelector('.mn-product-detail h4 a, .mn-product-detail h5 a');
        const nome = nameEl?.textContent?.trim() ?? '';

        // Price — prefer discounted price, fall back to any price text
        const priceEl =
          card.querySelector('.mn-price-new') ??
          card.querySelector('.mn-price');
        const preco = priceEl?.textContent?.trim() ?? '';

        // Link — real products use href="product-detail.html?itemid=<id>"
        const linkEl =
          card.querySelector('a.image[href*="itemid="]') ??
          card.querySelector('.mn-product-detail a[href*="itemid="]');
        const rawHref = linkEl?.getAttribute('href') ?? '';
        if (!rawHref) continue; // skip demo/template cards that have no itemid

        const link = rawHref.startsWith('http')
          ? rawHref
          : `${baseUrl}/${rawHref.replace(/^\//, '')}`;

        // Image — main product image (aliyuncs CDN for real products)
        const imgEl = card.querySelector('.mn-product-img img.main-img, .mn-product-img img');
        const imagem =
          imgEl?.getAttribute('src') ||
          imgEl?.getAttribute('data-src') ||
          '';

        if (nome && link) {
          results.push({ nome, preco, link, imagem });
        }
      }

      return results;
    }, BASE_URL);

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
 * Debug utility: dumps class names and sample HTML to identify selectors.
 * Run: npm run test:scraper selectors
 */
export async function scrapeSelectors() {
  const page = await newPage();
  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(3000);

    const info = await page.evaluate(() => {
      const allClasses = new Set();
      document.querySelectorAll('*').forEach((el) => {
        el.classList.forEach((c) => allClasses.add(c));
      });

      const bodies = [
        ...document.querySelectorAll('.mn-product-card, article, [class*="card"], [class*="product"]'),
      ]
        .slice(0, 3)
        .map((el) => el.outerHTML.slice(0, 1200));

      return { classes: [...allClasses], bodies };
    });

    console.log('\n=== CLASS LIST (filtered) ===');
    console.log(
      info.classes.filter((c) => /product|deal|card|item|price|title/i.test(c)).join('\n'),
    );
    console.log('\n=== SAMPLE HTML ===');
    info.bodies.forEach((b, i) => console.log(`\n--- Element ${i + 1} ---\n${b}`));
  } finally {
    await page.context().close();
  }
}
