import { supabase } from './supabase.js';

const TABLE = 'produtos_dealspro';
const OLD_DAYS = 5;

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
  const { data, error } = await supabase.from(TABLE).insert(products).select();
  if (error) throw new Error(`Failed to insert products: ${error.message}`);
  return data;
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
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - OLD_DAYS);

  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .lt('criado_em', cutoff.toISOString())
    .select('id');

  if (error) throw new Error(`Failed to delete old products: ${error.message}`);
  return data?.length ?? 0;
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
