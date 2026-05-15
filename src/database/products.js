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
    .select('id, hash, sizes')
    .limit(5000);

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
 * Marks products as unavailable using dois sinais:
 *  1. soldOutLinks: produto apareceu na listagem com imagem 800×900 (placeholder)
 *     → esgotado confirmado, marcado imediatamente.
 *  2. Ausência do scrape por UNAVAIL_THRESHOLD_MS
 *     → pode ser página 3+, timeout de categoria ou realmente esgotado.
 *     Threshold alto (3h) para reduzir falsos positivos.
 */
const UNAVAIL_THRESHOLD_MS = 3 * 60 * 60 * 1000; // 3 horas (~90 ciclos)

// Só atualiza last_seen_at quando passa desse tempo desde o último update.
// O scraper roda a cada ~3min, mas atualizar a cada ciclo gerava ~12k UPDATEs/h
// em produtos_dealspro (1.200 produtos × 20 ciclos/hora) e queimava o IO budget
// do Supabase. Como UNAVAIL_THRESHOLD_MS é 3h, manter granularidade de 30min
// não afeta a precisão de "produto sumiu".
const LAST_SEEN_STALE_MS = 30 * 60 * 1000; // 30 min

export async function syncAvailability(scrapedLinks, soldOutLinks = new Set()) {
  if (!scrapedLinks.size) return { markedUnavailable: 0, restored: 0, restoredIds: [] };

  const now = new Date();

  const { data, error } = await supabase
    .from(TABLE)
    .select('id, link, disponivel, last_seen_at');

  if (error) throw new Error(`syncAvailability fetch failed: ${error.message}`);

  const seenStale         = [];
  const toMarkUnavailable = [];
  const toRestore         = [];

  for (const p of data ?? []) {
    const isSoldOut = soldOutLinks.has(p.link);
    const inScrape  = scrapedLinks.has(p.link) && !isSoldOut;

    if (isSoldOut) {
      // Imagem placeholder 800×900 = esgotado confirmado pelo CSSDeals
      if (p.disponivel) toMarkUnavailable.push(p.id);
    } else if (inScrape) {
      if (!p.disponivel) toRestore.push(p.id);
      // Só atualiza last_seen_at se está stale — economiza ~95% dos UPDATEs
      const lastSeenAge = p.last_seen_at ? now - new Date(p.last_seen_at) : Infinity;
      if (lastSeenAge >= LAST_SEEN_STALE_MS) seenStale.push(p.id);
    } else if (p.disponivel) {
      // Ausente do scrape: só marca esgotado após threshold para evitar falsos positivos
      // de produtos em página 3+ ou categorias com timeout
      const lastSeen = p.last_seen_at ? new Date(p.last_seen_at) : new Date(0);
      if (now - lastSeen >= UNAVAIL_THRESHOLD_MS) {
        toMarkUnavailable.push(p.id);
      }
    }
  }

  if (seenStale.length) {
    await supabase.from(TABLE).update({ last_seen_at: now.toISOString() }).in('id', seenStale);
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
    lastSeenUpdated:   seenStale.length,
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
