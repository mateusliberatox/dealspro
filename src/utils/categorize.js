const RULES = [
  { name: 'Smartwatch',     keywords: ['watch', '手表', 'smartwatch', 'smart watch', 'relógio'] },
  { name: 'Bolsa / Mochila', keywords: ['bag', '包', 'backpack', 'mochila', 'bolsa', 'purse', 'tote', 'satchel'] },
  { name: 'Roupas',         keywords: ['shirt', 't-shirt', 'tshirt', 'hoodie', 'jacket', 'sweater', 'coat',
                                        'jeans', 'pants', 'shorts', 'dress', 'top', '长袖', '套装', '短袖',
                                        'corteiz', 'essentials', 'fog '] },
  { name: 'Eletrônicos',    keywords: ['speaker', 'bluetooth', '音响', 'earphone', 'headphone', 'fone',
                                        'cable', 'charger', 'powerbank', 'a500', 'sound'] },
  { name: 'Calçados',       keywords: ['shoes', 'sneaker', '鞋', 'boot', 'sandal', 'tênis', 'sport shoe'] },
];

/**
 * Returns a category name based on keyword matching in the product name.
 * Checks the original name AND translated name (if provided).
 */
export function categorize(nome, nomeTraduzido = '') {
  const text = `${nome} ${nomeTraduzido}`.toLowerCase();

  for (const rule of RULES) {
    if (rule.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
      return rule.name;
    }
  }

  return 'Outros';
}
