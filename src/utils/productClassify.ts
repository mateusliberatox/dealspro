import type { ScrapedProduct } from '../types.js';

type ItemId = string | number | bigint;
interface ExistingEntry { id: string | number }
interface PriceChange { item: ScrapedProduct; existingId: string | number }
interface ClassifyResult { newItems: ScrapedProduct[]; priceChanged: PriceChange[] }

/**
 * Separates candidate-new products into truly new vs. price changes.
 * A price change occurs when the cssdeals_item_id already exists in DB with a different hash.
 */
export function classifyProducts(
  candidateNew: ScrapedProduct[],
  existingItemIdMap: Map<ItemId, ExistingEntry>,
): ClassifyResult {
  const newItems:     ScrapedProduct[] = [];
  const priceChanged: PriceChange[]    = [];

  for (const item of candidateNew) {
    const id = item.cssdeals_item_id;
    if (id != null && existingItemIdMap.has(id)) {
      priceChanged.push({ item, existingId: existingItemIdMap.get(id)!.id });
    } else {
      newItems.push(item);
    }
  }

  return { newItems, priceChanged };
}
