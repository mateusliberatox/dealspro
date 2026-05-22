import { chromium } from 'playwright';
import 'dotenv/config';

let browserInstance  = null;
let browserLaunchedAt = 0;
const BROWSER_MAX_AGE_MS = 3 * 60 * 60 * 1000; // reinicia a cada 3h para evitar leaks

export async function getBrowser() {
  const now    = Date.now();
  const tooOld = browserLaunchedAt > 0 && (now - browserLaunchedAt) > BROWSER_MAX_AGE_MS;

  if (browserInstance?.isConnected() && !tooOld) return browserInstance;

  if (browserInstance) {
    await browserInstance.close().catch(() => {});
    browserInstance = null;
  }

  browserInstance = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',            // evita crash em Docker com /dev/shm limitado
      '--disable-blink-features=AutomationControlled',
    ],
  });
  browserLaunchedAt = now;

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
      '(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
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
