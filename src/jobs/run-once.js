import 'dotenv/config';
import { detectAndSaveNewProducts } from '../services/productService.js';
import { closeBrowser } from '../scraper/browser.js';
import { logger } from '../utils/logger.js';

try {
  logger.info('Run-once cycle starting');
  const newProducts = await detectAndSaveNewProducts();
  logger.success(`Done — ${newProducts.length} new product(s) saved`);
} catch (err) {
  logger.error(`Run-once failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeBrowser();
}
