import { createHash } from 'crypto';

/**
 * Generates a deterministic hash for a product.
 * Used to detect duplicates regardless of insertion order.
 * Fields: name + price + link (image excluded — URLs can rotate on CDNs).
 */
export function generateProductHash(nome, preco, link) {
  const raw = `${nome.trim().toLowerCase()}|${preco.trim()}|${link.trim()}`;
  return createHash('sha256').update(raw).digest('hex');
}
