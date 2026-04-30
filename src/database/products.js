import { supabase } from './supabase.js';

const TABLE = 'produtos';

/**
 * Returns the set of hashes already stored in the database.
 * Used to diff against freshly scraped products.
 */
export async function getExistingHashes() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('hash');

  if (error) throw new Error(`Failed to fetch hashes: ${error.message}`);
  return new Set(data.map((r) => r.hash));
}

/**
 * Inserts a batch of new products.
 * The `hash` column has a UNIQUE constraint — double-safety against duplicates.
 */
export async function insertProducts(products) {
  if (!products.length) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .insert(products)
    .select();

  if (error) throw new Error(`Failed to insert products: ${error.message}`);
  return data;
}

/**
 * Fetches the N most recent products (for display/debug).
 */
export async function getLatestProducts(limit = 20) {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to fetch latest products: ${error.message}`);
  return data;
}
