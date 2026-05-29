import { chromium, type Browser, type Page } from 'playwright';
import 'dotenv/config';

let browserInstance:   Browser | null = null;
let browserLaunchedAt = 0;
let launchPromise:     Promise<Browser> | null = null;
const BROWSER_MAX_AGE_MS = 3 * 60 * 60 * 1000; // 3 horas

export async function getBrowser(): Promise<Browser> {
  const now    = Date.now();
  const tooOld = browserLaunchedAt > 0 && (now - browserLaunchedAt) > BROWSER_MAX_AGE_MS;

  if (browserInstance?.isConnected() && !tooOld) return browserInstance;

  if (!launchPromise) {
    launchPromise = (async () => {
      if (browserInstance) {
        await browserInstance.close().catch(() => {});
        browserInstance = null;
      }
      browserInstance = await chromium.launch({
        headless: process.env.HEADLESS !== 'false',
        args: [
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--no-zygote',
          '--disable-gpu',
          '--disable-software-rasterizer',
        ],
      });
      browserLaunchedAt = Date.now();
      return browserInstance;
    })().finally(() => { launchPromise = null; });
  }

  return launchPromise;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// Tipos de recurso que o scraper nunca precisa — bloquear reduz egress em ~85%
// e acelera o carregamento da página (sem esperar imagens de 2-3MB por listagem).
const BLOCKED_RESOURCE_TYPES = new Set([
  'image', 'stylesheet', 'font', 'media', 'manifest', 'other',
]);

// Domínios de analytics/tracking que só geram tráfego desnecessário
const BLOCKED_DOMAINS = [
  'google-analytics.com', 'googletagmanager.com', 'facebook.com',
  'doubleclick.net', 'hotjar.com', 'clarity.ms',
];

/** Creates a new page with a realistic browser profile and resource blocking. */
export async function newPage(): Promise<Page> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
    locale:   'en-US',
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
  });

  const page = await context.newPage();

  // Bloqueia recursos desnecessários para reduzir egress de rede no Railway.
  // CSSDeals renderiza a listagem via HTML/JS — CSS e imagens não são necessários para scraping.
  await page.route('**/*', (route) => {
    const type = route.request().resourceType();
    const url  = route.request().url();
    if (
      BLOCKED_RESOURCE_TYPES.has(type) ||
      BLOCKED_DOMAINS.some((d) => url.includes(d))
    ) {
      route.abort();
    } else {
      route.continue();
    }
  });

  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  return page;
}
