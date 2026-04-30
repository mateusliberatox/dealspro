import { chromium } from 'playwright';
import 'dotenv/config';

let browserInstance = null;

/**
 * Returns a shared browser instance (singleton).
 * Playwright launches Chromium with stealth-friendly settings to avoid 403s.
 */
export async function getBrowser() {
  if (browserInstance) return browserInstance;

  browserInstance = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    args: [
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  return browserInstance;
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

/**
 * Creates a new page with a realistic browser profile.
 */
export async function newPage() {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    locale: 'en-US',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });

  const page = await context.newPage();

  // Remove the navigator.webdriver flag that sites use to detect automation
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return page;
}
