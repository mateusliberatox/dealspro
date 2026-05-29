import { createHash } from 'crypto';

/**
 * Generates a deterministic SHA-256 hash for a product.
 * Fields: name + price + link (image excluded — URLs rotate on CDNs).
 */
export function generateProductHash(nome: string, preco: string, link: string): string {
  const raw = `${nome.trim().toLowerCase()}|${preco.trim().replace(/\s+/g, '')}|${link.trim()}`;
  return createHash('sha256').update(raw).digest('hex');
}
