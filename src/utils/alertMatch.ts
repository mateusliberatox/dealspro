import type { Product, Alert } from '../types.js';

/**
 * Returns true if a product satisfies an alert's criteria.
 *
 * Rules:
 *  - keyword + categoria: both must match
 *  - keyword only: keyword must match
 *  - categoria only: categoria must match
 *  - neither: never matches (misconfigured alert)
 *  - size (optional): product must contain the size (case-insensitive)
 */
export function productMatchesAlert(product: Product, alert: Alert): boolean {
  const searchText     = `${product.nome} ${product.nome_traduzido ?? ''}`.toLowerCase();
  const hasKeyword     = !!alert.keyword;
  const hasCategoria   = !!alert.categoria;
  const keywordMatch   = hasKeyword   && searchText.includes(alert.keyword!.toLowerCase());
  const categoriaMatch = hasCategoria && product.categoria === alert.categoria;

  if (hasKeyword && hasCategoria) {
    if (!keywordMatch || !categoriaMatch) return false;
  } else if (hasKeyword) {
    if (!keywordMatch) return false;
  } else if (hasCategoria) {
    if (!categoriaMatch) return false;
  } else {
    return false;
  }

  return !alert.size ||
    (product.sizes ?? []).some((s) => s.toUpperCase() === alert.size!.toUpperCase());
}
