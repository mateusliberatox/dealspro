/**
 * Standalone scraper test — runs without Supabase.
 * Use this to validate that the scraper can reach the site
 * and parse products before connecting the database.
 *
 * Run: npm run test:scraper
 */
import 'dotenv/config';
import { scrapeCssDeals, scrapeSelectors } from './index.js';
import { closeBrowser } from './browser.js';

const mode = process.argv[2]; // "selectors" or omit for normal scrape

try {
  if (mode === 'selectors') {
    console.log('Running selector discovery...\n');
    await scrapeSelectors();
  } else {
    console.log('Running scrape test...\n');
    const products = await scrapeCssDeals();

    if (!products.length) {
      console.log('No products found. Run with "selectors" to inspect the page:');
      console.log('  npm run test:scraper selectors\n');
    } else {
      console.log(`\nFound ${products.length} products:\n`);
      products.forEach((p, i) => {
        console.log(`${i + 1}. ${p.nome}`);
        console.log(`   Price: ${p.preco || '(no price found)'}`);
        console.log(`   Link:  ${p.link}`);
        console.log(`   Image: ${p.imagem || '(no image found)'}\n`);
      });
    }
  }
} catch (err) {
  console.error('Test failed:', err.message);
} finally {
  await closeBrowser();
}
