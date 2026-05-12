import { supabase } from './supabase.js';

const TABLE = 'produtos_dealspro';
const OLD_DAYS           = 5;  // produtos indisponíveis: deletar após 5 dias
const OLD_DAYS_AVAILABLE = 30; // produtos disponíveis: deletar após 30 dias (nunca re-notifica pois já tem log)

/**
 * Returns a Map<hash, { id, sizes }> for all stored products.
 * Used to detect new items and merge sizes on existing ones.
 */
export async function getExistingHashMap() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('id, hash, sizes');

  if (error) throw new Error(`Failed to fetch hashes: ${error.message}`);
  return new Map(data.map((r) => [r.hash, { id: r.id, sizes: r.sizes ?? [] }]));
}

/** Kept for backward-compatibility with test scripts */
export async function getExistingHashes() {
  const map = await getExistingHashMap();
  return new Set(map.keys());
}

export async function insertProducts(products) {
  if (!products.length) return [];
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(products, { onConflict: 'hash', ignoreDuplicates: true })
    .select();
  if (error) throw new Error(`Failed to insert products: ${error.message}`);
  return data ?? [];
}

/**
 * Merges new sizes into an existing product (union, no duplicates).
 * Skips update if nothing changed.
 */
export async function mergeSizes(id, existingSizes, newSizes) {
  const merged = [...new Set([...existingSizes, ...newSizes])];
  if (merged.length === existingSizes.length) return; // nothing new

  const { error } = await supabase
    .from(TABLE)
    .update({ sizes: merged })
    .eq('id', id);

  if (error) throw new Error(`Failed to merge sizes for id ${id}: ${error.message}`);
}

/**
 * Updates only the categoria field of a product.
 */
export async function updateCategoria(id, categoria) {
  const { error } = await supabase
    .from(TABLE)
    .update({ categoria })
    .eq('id', id);

  if (error) throw new Error(`Failed to update categoria: ${error.message}`);
}

/**
 * Deletes products older than OLD_DAYS days.
 * Returns the count of deleted rows.
 */
export async function deleteOldProducts() {
  const cutoffUnavailable = new Date();
  cutoffUnavailable.setDate(cutoffUnavailable.getDate() - OLD_DAYS);

  const cutoffAvailable = new Date();
  cutoffAvailable.setDate(cutoffAvailable.getDate() - OLD_DAYS_AVAILABLE);

  // Produtos indisponíveis: deletar após 5 dias
  const { data: d1, error: e1 } = await supabase
    .from(TABLE)
    .delete()
    .lt('criado_em', cutoffUnavailable.toISOString())
    .eq('disponivel', false)
    .select('id');
  if (e1) throw new Error(`Failed to delete unavailable products: ${e1.message}`);

  // Produtos ainda disponíveis: deletar após 30 dias (notification_logs já impede repost)
  const { data: d2, error: e2 } = await supabase
    .from(TABLE)
    .delete()
    .lt('criado_em', cutoffAvailable.toISOString())
    .eq('disponivel', true)
    .select('id');
  if (e2) throw new Error(`Failed to delete old available products: ${e2.message}`);

  return (d1?.length ?? 0) + (d2?.length ?? 0);
}

/**
 * Marks products as unavailable only after they've been absent from the scrape
 * for at least UNAVAIL_THRESHOLD_MS (30 min = ~15 scrape cycles).
 * A single missed scrape cycle (page 3+, timeout, etc.) does not trigger the mark.
 * Also restores products that reappeared (restocked).
 */
const UNAVAIL_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

export async function syncAvailability(scrapedLinks) {
  if (!scrapedLinks.size) return { markedUnavailable: 0, restored: 0, restoredIds: [] };

  const now = new Date();

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, link, disponivel, last_seen_at');

  if (error) throw new Error(`syncAvailability fetch failed: ${error.message}`);

  const seen       = [];
  const toMarkUnavailable = [];
  const toRestore  = [];

  for (const p of data ?? []) {
    const inScrape = scrapedLinks.has(p.link);

    if (inScrape) {
      // Update last_seen_at for all products found in this scrape
      seen.push(p.id);
      if (!p.disponivel) toRestore.push(p.id);
    } else if (p.disponivel) {
      // Only mark unavailable if absent for longer than threshold
      const lastSeen = p.last_seen_at ? new Date(p.last_seen_at) : new Date(0);
      if (now - lastSeen >= UNAVAIL_THRESHOLD_MS) {
        toMarkUnavailable.push(p.id);
      }
    }
  }

  if (seen.length) {
    await supabase.from(TABLE).update({ last_seen_at: now.toISOString() }).in('id', seen);
  }
  if (toMarkUnavailable.length) {
    await supabase.from(TABLE).update({ disponivel: false }).in('id', toMarkUnavailable);
  }
  if (toRestore.length) {
    await supabase.from(TABLE).update({ disponivel: true }).in('id', toRestore);
  }

  return {
    markedUnavailable: toMarkUnavailable.length,
    restored:          toRestore.length,
    restoredIds:       toRestore,
  };
}

export async function getLatestProducts(limit = 20) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch latest products: ${error.message}`);
  return data;
}
