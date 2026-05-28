// @ts-check
import { createHash } from 'crypto';

/**
 * Generates a deterministic hash for a product.
 * Used to detect duplicates regardless of insertion order.
 * Fields: name + price + link (image excluded — URLs can rotate on CDNs).
 *
 * @param {string} nome
 * @param {string} preco
 * @param {string} link
 * @returns {string} SHA-256 hex string
 */
export function generateProductHash(nome, preco, link) {
  const raw = `${nome.trim().toLowerCase()}|${preco.trim().replace(/\s+/g, '')}|${link.trim()}`;
  return createHash('sha256').update(raw).digest('hex');
}
