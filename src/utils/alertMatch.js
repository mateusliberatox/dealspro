/**
 * Retorna true se um produto satisfaz os critérios de um alerta.
 *
 * Regras:
 *  - keyword + categoria: ambos devem casar
 *  - apenas keyword: keyword deve casar
 *  - apenas categoria: categoria deve casar
 *  - nenhum dos dois: nunca casa (alerta mal configurado)
 *  - size (opcional): produto deve conter o tamanho (case-insensitive)
 */
export function productMatchesAlert(product, alert) {
  const searchText     = `${product.nome} ${product.nome_traduzido ?? ''}`.toLowerCase();
  const hasKeyword     = !!alert.keyword;
  const hasCategoria   = !!alert.categoria;
  const keywordMatch   = hasKeyword   && searchText.includes(alert.keyword.toLowerCase());
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
    (product.sizes ?? []).some((s) => s.toUpperCase() === alert.size.toUpperCase());
}
