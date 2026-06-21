import { supabase } from './supabase.js';
import { logger } from '../utils/logger.js';
import type { Product } from '../types.js';

const TABLE = 'produtos_dealspro';
const OLD_DAYS           = 5;
const OLD_DAYS_AVAILABLE = 30;
const NOTIF_LOG_DAYS     = 60;

interface HashEntry { id: string | number; sizes: string[]; cssdeals_item_id: string | null }
interface SyncResult { markedUnavailable: number; restored: number; restoredIds: (string | number)[]; lastSeenUpdated?: number }

// Cache em memória do hash-map: evita varrer produtos_dealspro a cada ciclo
// (a cada ~60s) e, se o Supabase estiver lento/fora, usa o último snapshot
// conhecido em vez de abortar o ciclo inteiro.
const HASHMAP_CACHE_TTL_MS = 10 * 60 * 1000;
let _hashMapCache: { map: Map<string, HashEntry>; ts: number } | null = null;

async function fetchHashMap(): Promise<Map<string, HashEntry>> {
  const map  = new Map<string, HashEntry>();
  const PAGE = 1000;
  let   from = 0;
  const cutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, hash, sizes, cssdeals_item_id')
      .gte('criado_em', cutoff)
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`Failed to fetch hashes: ${error.message}`);
    if (!data?.length) break;

    for (const r of data as Array<{ id: string | number; hash: string; sizes?: string[]; cssdeals_item_id?: string | null }>) {
      map.set(r.hash, { id: r.id, sizes: r.sizes ?? [], cssdeals_item_id: r.cssdeals_item_id ?? null });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return map;
}

export async function getExistingHashMap(): Promise<Map<string, HashEntry>> {
  const now = Date.now();
  if (_hashMapCache && (now - _hashMapCache.ts) < HASHMAP_CACHE_TTL_MS) {
    return _hashMapCache.map;
  }

  try {
    const map = await fetchHashMap();
    _hashMapCache = { map, ts: now };
    return map;
  } catch (e) {
    if (_hashMapCache) {
      const ageMin = Math.round((now - _hashMapCache.ts) / 60_000);
      logger.warn(`getExistingHashMap: usando cache de ${ageMin}min atrás (DB indisponível): ${(e as Error).message}`);
      return _hashMapCache.map;
    }
    throw e;
  }
}

/** Mantém o cache em memória sincronizado após inserts feitos por este processo. */
export function cacheNewHashes(entries: Array<{ hash?: string; id?: string | number; sizes?: string[]; cssdeals_item_id?: string | null }>): void {
  if (!_hashMapCache) return;
  for (const e of entries) {
    if (!e.hash || e.id == null) continue;
    _hashMapCache.map.set(e.hash, { id: e.id, sizes: e.sizes ?? [], cssdeals_item_id: e.cssdeals_item_id ?? null });
  }
}

export async function insertProducts(products: Record<string, unknown>[]): Promise<Product[]> {
  if (!products.length) return [];
  const insertedAfter = new Date().toISOString();

  const { error } = await supabase
    .from(TABLE)
    .upsert(products, { onConflict: 'hash', ignoreDuplicates: true });

  if (error) throw new Error(`Failed to insert products: ${error.message}`);

  const { data, error: fetchError } = await supabase
    .from(TABLE)
    .select('*')
    .gte('criado_em', insertedAfter);

  if (fetchError) throw new Error(`Failed to fetch inserted products: ${fetchError.message}`);
  return (data ?? []) as Product[];
}

export async function updateProductPrice(id: string | number, preco: string): Promise<void> {
  const { error } = await supabase.from(TABLE).update({ preco }).eq('id', id);
  if (error) throw new Error(`Failed to update price for id ${id}: ${error.message}`);
}

export async function mergeSizes(id: string | number, existingSizes: string[], newSizes: string[]): Promise<void> {
  const merged = [...new Set([...existingSizes, ...newSizes])];
  if (merged.length === existingSizes.length) return;
  const { error } = await supabase.from(TABLE).update({ sizes: merged }).eq('id', id);
  if (error) throw new Error(`Failed to merge sizes for id ${id}: ${error.message}`);
}

export async function deleteOldProducts(): Promise<number> {
  const cutoffUnavailable = new Date();
  cutoffUnavailable.setDate(cutoffUnavailable.getDate() - OLD_DAYS);
  const cutoffAvailable = new Date();
  cutoffAvailable.setDate(cutoffAvailable.getDate() - OLD_DAYS_AVAILABLE);

  const { data: d1, error: e1 } = await supabase
    .from(TABLE).delete()
    .lt('criado_em', cutoffUnavailable.toISOString()).eq('disponivel', false).select('id');
  if (e1) throw new Error(`Failed to delete unavailable products: ${e1.message}`);

  const { data: d2, error: e2 } = await supabase
    .from(TABLE).delete()
    .lt('criado_em', cutoffAvailable.toISOString()).eq('disponivel', true).select('id');
  if (e2) throw new Error(`Failed to delete old available products: ${e2.message}`);

  const cutoffLogs = new Date();
  cutoffLogs.setDate(cutoffLogs.getDate() - NOTIF_LOG_DAYS);
  const { error: e3 } = await supabase
    .from('notification_logs').delete()
    .lt('created_at', cutoffLogs.toISOString())
    .in('channel', ['discord_premium', 'discord_free', 'telegram_feed']);
  if (e3) throw new Error(`Failed to delete old notification logs: ${e3.message}`);

  const cutoffDmLogs = new Date();
  cutoffDmLogs.setMonth(cutoffDmLogs.getMonth() - 6);
  const { error: e4 } = await supabase
    .from('notification_logs').delete()
    .lt('created_at', cutoffDmLogs.toISOString())
    .in('channel', ['discord_dm', 'telegram_dm']);
  if (e4) throw new Error(`Failed to delete old DM logs: ${e4.message}`);

  const cutoffTranslations = new Date();
  cutoffTranslations.setDate(cutoffTranslations.getDate() - 90);
  const { error: e5 } = await supabase
    .from('translation_cache').delete().lt('criado_em', cutoffTranslations.toISOString());
  if (e5) throw new Error(`Failed to delete old translation cache: ${e5.message}`);

  return (d1?.length ?? 0) + (d2?.length ?? 0);
}

const UNAVAIL_THRESHOLD_MS = 3 * 60 * 60 * 1000;
// last_seen_at só é usado para marcar indisponível após UNAVAIL_THRESHOLD_MS (3h),
// então refrescá-lo a cada 60min (em vez de 30) não afeta a lógica de esgotado —
// mas corta pela metade a maior fonte de escrita em produtos_dealspro (~48k upd/dia).
// Isso compensa o aumento de produtos rastreados por ciclo após MAX_PAGES=2.
const LAST_SEEN_STALE_MS   = parseInt(process.env.LAST_SEEN_STALE_MINUTES ?? '60', 10) * 60 * 1000;

export async function syncAvailability(
  scrapedLinks: Set<string>,
  soldOutLinks: Set<string> = new Set(),
): Promise<SyncResult> {
  if (!scrapedLinks.size) return { markedUnavailable: 0, restored: 0, restoredIds: [] };

  const now    = new Date();
  const cutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from(TABLE).select('id, link, disponivel, last_seen_at').gte('criado_em', cutoff);

  if (error) throw new Error(`syncAvailability fetch failed: ${error.message}`);

  const seenStale:         (string | number)[] = [];
  const toMarkUnavailable: (string | number)[] = [];
  const toRestore:         (string | number)[] = [];

  for (const p of (data ?? []) as Array<{ id: string | number; link: string; disponivel: boolean; last_seen_at?: string }>) {
    const isSoldOut = soldOutLinks.has(p.link);
    const inScrape  = scrapedLinks.has(p.link) && !isSoldOut;

    if (isSoldOut) {
      if (p.disponivel) toMarkUnavailable.push(p.id);
    } else if (inScrape) {
      if (!p.disponivel) toRestore.push(p.id);
      const lastSeenAge = p.last_seen_at ? now.getTime() - new Date(p.last_seen_at).getTime() : Infinity;
      if (lastSeenAge >= LAST_SEEN_STALE_MS) seenStale.push(p.id);
    } else if (p.disponivel) {
      const lastSeen = p.last_seen_at ? new Date(p.last_seen_at) : new Date(0);
      if (now.getTime() - lastSeen.getTime() >= UNAVAIL_THRESHOLD_MS) {
        toMarkUnavailable.push(p.id);
      }
    }
  }

  if (seenStale.length)         await supabase.from(TABLE).update({ last_seen_at: now.toISOString() }).in('id', seenStale);
  if (toMarkUnavailable.length) await supabase.from(TABLE).update({ disponivel: false }).in('id', toMarkUnavailable);
  if (toRestore.length)         await supabase.from(TABLE).update({ disponivel: true }).in('id', toRestore);

  return { markedUnavailable: toMarkUnavailable.length, restored: toRestore.length, restoredIds: toRestore, lastSeenUpdated: seenStale.length };
}

/**
 * Detecção de restock leve para o fast cycle (a cada 60s). Consulta apenas os
 * itens atualmente indisponíveis (subconjunto pequeno) e restaura os que
 * reapareceram no scrape parcial — sem nunca marcar nada como indisponível,
 * pois um scrape de homepage + categorias quentes não prova ausência.
 *
 * Isso faz restocks dos itens mais quentes aparecerem em ~60s em vez de
 * esperar o full cycle (~180s+). Custo de Disk IO desprezível: lê só linhas
 * com disponivel=false (servidas do cache) e escreve só nos itens restocados.
 */
export async function restoreSeenProducts(
  scrapedLinks: Set<string>,
  soldOutLinks: Set<string> = new Set(),
): Promise<Pick<SyncResult, 'restored' | 'restoredIds'>> {
  if (!scrapedLinks.size) return { restored: 0, restoredIds: [] };

  const cutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from(TABLE).select('id, link').eq('disponivel', false).gte('criado_em', cutoff);

  if (error) throw new Error(`restoreSeenProducts fetch failed: ${error.message}`);

  const toRestore = ((data ?? []) as Array<{ id: string | number; link: string }>)
    .filter((p) => scrapedLinks.has(p.link) && !soldOutLinks.has(p.link))
    .map((p) => p.id);

  if (!toRestore.length) return { restored: 0, restoredIds: [] };

  await supabase.from(TABLE)
    .update({ disponivel: true, last_seen_at: new Date().toISOString() })
    .in('id', toRestore);

  return { restored: toRestore.length, restoredIds: toRestore };
}
