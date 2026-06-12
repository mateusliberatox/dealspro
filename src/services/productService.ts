import { scrapeCssDeals, fetchQcImage } from '../scraper/index.js';
import { getExistingHashMap, insertProducts, mergeSizes, deleteOldProducts, syncAvailability, updateProductPrice } from '../database/products.js';
import { generateProductHash } from '../utils/hash.js';
import { translateName } from '../utils/translate.js';
import { categorize } from '../utils/categorize.js';
import { classifyProducts } from '../utils/productClassify.js';
import { logger } from '../utils/logger.js';
import { dispatchNotifications } from '../notifications/index.js';
import { matchAndNotify } from '../notifications/alertService.js';
import { sendFreeDelayedNotifications, announceNewBatch, updateQcImagesInDiscord, announceRestock } from '../notifications/discord.js';
import { notifyTelegramPremiumFeed, notifyTelegramFreeFeed, notifyTelegramRestock } from '../notifications/telegramFeed.js';
import { supabase } from '../database/supabase.js';
import type { Product } from '../types.js';

async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 3): Promise<T> {
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === attempts - 1) throw e;
      const delay = 2000 * (i + 1);
      logger.warn(`${label} falhou (tentativa ${i + 1}/${attempts}) — retry em ${delay / 1000}s: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw new Error('unreachable');
}

const MAX_QC_FETCHES        = 100;
const QC_BATCH_SIZE         = 3;
const FREE_DELAY_MS         = parseInt(process.env.FREE_DELAY_MINUTES ?? '30', 10) * 60 * 1000;
// Com MAX_PAGES=1 e 20 categorias, um scrape saudável retorna ~350-380 produtos.
// Threshold deve detectar scrapes genuinamente ruins (<50% do esperado), não o normal.
const MIN_SCRAPE_QUALITY = parseInt(process.env.MIN_SCRAPE_QUALITY ?? '200', 10);
const TRANSLATE_CONCURRENCY = 16;

let _qcEnrichmentInProgress = false;

/**
 * Fetches QC photos and silently updates the DB after notifications are already sent.
 * Non-blocking — caller should not await this.
 */
async function enrichWithQcImages(products: Product[]): Promise<void> {
  if (_qcEnrichmentInProgress) { logger.info('QC enrichment já em andamento — pulando'); return; }
  _qcEnrichmentInProgress = true;
  try {
    const toFetch  = products.slice(0, MAX_QC_FETCHES);
    const updates: Product[] = [];

    for (let i = 0; i < toFetch.length; i += QC_BATCH_SIZE) {
      const batch   = toFetch.slice(i, i + QC_BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((p) => fetchQcImage(p.link)));
      results.forEach((r, j) => {
        if (r.status === 'fulfilled' && r.value) {
          updates.push({ ...toFetch[i + j], imagem: r.value });
        }
      });
      if (i + QC_BATCH_SIZE < toFetch.length) await new Promise((r) => setTimeout(r, 2000));
    }

    if (!updates.length) {
      logger.warn(`QC: nenhuma imagem obtida para ${toFetch.length} produto(s) — possível bloqueio`);
      return;
    }

    const { error: upsertErr } = await supabase
      .from('produtos_dealspro')
      .upsert(updates.map(({ id, imagem }) => ({ id, imagem })));
    if (upsertErr) logger.warn(`QC bulk update falhou: ${upsertErr.message}`);
    else           logger.info(`QC: updated ${updates.length} image(s)`);

    await updateQcImagesInDiscord(updates).catch((e: Error) => logger.warn(`QC Discord edit failed: ${e.message}`));
  } finally {
    _qcEnrichmentInProgress = false;
  }
}

export async function detectAndSaveNewProducts({ homepageOnly = false } = {}): Promise<Product[]> {
  logger.info(homepageOnly ? 'Starting fast cycle (homepage only)' : 'Starting full detection cycle');

  try {
    const deleted = await deleteOldProducts();
    if (deleted > 0) logger.info(`Deleted ${deleted} expired product(s)`);
  } catch (e: unknown) {
    logger.warn(`Housekeeping skipped (será refeito no próximo ciclo): ${(e as Error).message}`);
  }

  if (!homepageOnly) {
    try {
      await sendFreeDelayedNotifications();
      await notifyTelegramFreeFeed();
    } catch (e: unknown) {
      logger.warn(`Delayed notifications skipped: ${(e as Error).message}`);
    }
  }

  const scraped = await scrapeCssDeals({ homepageOnly });
  if (!scraped.length) {
    logger.warn('No products scraped — site may have blocked or changed layout');
    return [];
  }

  const MIN_HOMEPAGE_PRODUCTS = 5;
  if (homepageOnly && scraped.length < MIN_HOMEPAGE_PRODUCTS) {
    logger.warn(`Homepage retornou apenas ${scraped.length} produto(s) — possível quebra de seletor CSS ou bloqueio`);
    const adminWebhook = process.env.DISCORD_ADMIN_WEBHOOK_URL;
    if (adminWebhook) {
      fetch(adminWebhook, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          content: `⚠️ **DealsPro — Seletor CSS degradado**: homepage retornou apenas **${scraped.length}** produto(s). Possível mudança de layout no CSSDeals ou bloqueio Cloudflare.`,
        }),
        signal: AbortSignal.timeout(8_000),
      }).catch(() => {});
    }
  }

  const withHashes = scraped.map((p) => ({
    ...p,
    hash: generateProductHash(p.nome, p.preco, p.link),
  }));

  let existingMap: Awaited<ReturnType<typeof getExistingHashMap>>;
  try {
    existingMap = await withRetry(() => getExistingHashMap(), 'getExistingHashMap');
    logger.info(`DB has ${existingMap.size} existing hashes`);
  } catch (e: unknown) {
    logger.error(`getExistingHashMap failed após retries — abortando ciclo: ${(e as Error).message}`);
    return [];
  }

  const soldOutLinks = new Set(scraped.filter((p) => p.isSoldOut).map((p) => p.link));
  const scrapedLinks = new Set(withHashes.map((p) => p.link));

  if (soldOutLinks.size > 0) logger.info(`${soldOutLinks.size} produto(s) com placeholder 800×900 detectados como esgotados`);

  const scrapeOk = !homepageOnly && scraped.length >= MIN_SCRAPE_QUALITY;
  if (!scrapeOk && !homepageOnly) {
    logger.warn(`Scrape returned only ${scraped.length} products (< ${MIN_SCRAPE_QUALITY}) — skipping availability sync to avoid false sold-out marks`);
  }
  const { markedUnavailable, restored, restoredIds } = scrapeOk
    ? await syncAvailability(scrapedLinks, soldOutLinks).catch((e: Error) => {
        logger.warn(`syncAvailability falhou (não-fatal): ${e.message}`);
        return { markedUnavailable: 0, restored: 0, restoredIds: [] };
      })
    : { markedUnavailable: 0, restored: 0, restoredIds: [] };
  if (markedUnavailable > 0) logger.info(`Marked ${markedUnavailable} product(s) as unavailable (esgotado)`);
  if (restored > 0) {
    logger.info(`Restored ${restored} product(s) to available (restocado)`);
    if (restoredIds.length) {
      const { data: restocked } = await supabase
        .from('produtos_dealspro')
        .select('*')
        .in('id', restoredIds);
      if (restocked?.length) {
        await matchAndNotify(restocked as Product[], { isRestock: true });
        await announceRestock(restocked as Product[]).catch((e: Error) => logger.warn(`announceRestock falhou: ${e.message}`));
        await notifyTelegramRestock(restocked as Product[]).catch((e: Error) => logger.warn(`notifyTelegramRestock falhou: ${e.message}`));
      }
    }
  }

  const candidateNew  = withHashes.filter((p) => !existingMap.has(p.hash) && !p.isSoldOut);
  const existingItems = withHashes.filter((p) =>  existingMap.has(p.hash));

  const existingItemIdMap = new Map<string, { id: string | number }>();
  for (const [, val] of existingMap) {
    if (val.cssdeals_item_id != null) existingItemIdMap.set(val.cssdeals_item_id, val);
  }

  const { newItems, priceChanged } = classifyProducts(candidateNew, existingItemIdMap);

  if (priceChanged.length) {
    await Promise.allSettled(
      priceChanged.map(({ item, existingId }) =>
        updateProductPrice(existingId, item.preco).catch((e: Error) =>
          logger.warn(`Price update failed for id ${existingId}: ${e.message}`),
        ),
      ),
    );
    logger.info(`Updated price for ${priceChanged.length} product(s) (not new — same item_id)`);
  }

  logger.info(`Found ${newItems.length} new, ${existingItems.length} existing, ${priceChanged.length} price-changed`);

  await Promise.allSettled(
    existingItems
      .filter((p) => p.sizes?.length)
      .map((p) => {
        const existing = existingMap.get(p.hash)!;
        return mergeSizes(existing.id, existing.sizes, p.sizes).catch(
          (e: Error) => logger.warn(`Size merge skipped: ${e.message}`),
        );
      }),
  );

  if (!newItems.length) return [];

  const enriched: Product[] = [];
  for (let i = 0; i < newItems.length; i += TRANSLATE_CONCURRENCY) {
    const batch   = newItems.slice(i, i + TRANSLATE_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (p) => {
        const nome_traduzido = await translateName(p.nome);
        const categoria      = categorize(p.nome, nome_traduzido);
        return { ...p, nome_traduzido, categoria };
      }),
    );
    enriched.push(...results);
  }

  const visibleAt = new Date(Date.now() + FREE_DELAY_MS).toISOString();
  const rows = enriched.map((p) => ({
    nome:             p.nome,
    nome_traduzido:   p.nome_traduzido,
    preco:            p.preco,
    link:             p.link,
    imagem:           p.imagem,
    hash:             p.hash,
    categoria:        p.categoria,
    sizes:            p.sizes ?? [],
    cssdeals_item_id: p.cssdeals_item_id ?? null,
    visible_at:       visibleAt,
    free_notified:    false,
  }));

  let inserted: Product[];
  try {
    inserted = await withRetry(() => insertProducts(rows), 'insertProducts');
    logger.success(`Saved ${inserted.length} new product(s) (visible to free at ${visibleAt})`);
  } catch (e: unknown) {
    logger.error(`insertProducts failed após retries — abortando notificações: ${(e as Error).message}`);
    return [];
  }

  await dispatchNotifications(inserted).catch((e: Error) => logger.warn(`dispatchNotifications falhou: ${e.message}`));
  await matchAndNotify(inserted).catch((e: Error) => logger.warn(`matchAndNotify falhou: ${e.message}`));
  await notifyTelegramPremiumFeed(inserted).catch((e: Error) => logger.warn(`telegramPremiumFeed falhou: ${e.message}`));
  await announceNewBatch(inserted.length, inserted.map((p) => p.categoria)).catch((e: Error) => logger.warn(`announceNewBatch falhou: ${e.message}`));

  if (inserted.length > 0) {
    enrichWithQcImages(inserted).catch((e: Error) => logger.warn(`QC enrichment failed: ${e.message}`));
  }

  return inserted;
}

/**
 * Recupera produtos das últimas 24h que ficaram com imagem placeholder após um restart.
 * Chamado uma vez na inicialização do monitor — não bloqueia o primeiro ciclo.
 */
export async function enrichMissingQcImages(): Promise<void> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('produtos_dealspro')
    .select('*')
    .gte('criado_em', cutoff)
    .or('imagem.is.null,imagem.ilike.%skin/img/product/%,imagem.ilike.%placeholder%');

  if (error) { logger.warn(`QC rehydrate query failed: ${error.message}`); return; }
  if (!data?.length) return;

  logger.info(`QC rehydrate: ${data.length} produto(s) sem imagem válida`);
  await enrichWithQcImages(data as Product[]);
}
