/**
 * Separa candidatos a novos produtos entre realmente novos e mudanças de preço.
 * Um item é considerado "mudança de preço" quando seu cssdeals_item_id já existe
 * no DB com hash diferente (mesmo produto, preço atualizado).
 *
 * @param {Array}  candidateNew      - Produtos cujo hash não existe no DB
 * @param {Map<string, {id}>} existingItemIdMap - Mapeado por cssdeals_item_id
 * @returns {{ newItems: Array, priceChanged: Array<{item, existingId}> }}
 */
export function classifyProducts(candidateNew, existingItemIdMap) {
  const newItems     = [];
  const priceChanged = [];

  for (const item of candidateNew) {
    if (item.cssdeals_item_id && existingItemIdMap.has(item.cssdeals_item_id)) {
      priceChanged.push({ item, existingId: existingItemIdMap.get(item.cssdeals_item_id).id });
    } else {
      newItems.push(item);
    }
  }

  return { newItems, priceChanged };
}
