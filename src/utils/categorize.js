const RULES = [
  { name: 'Smartwatch', keywords: [
    'watch', 'smartwatch', 'smart watch', 'relógio', '手表', '智能手表',
  ]},
  { name: 'Bolsa / Mochila', keywords: [
    'bag', 'backpack', 'mochila', 'bolsa', 'purse', 'tote', 'satchel',
    'crossbody', 'clutch', 'duffel', 'handbag', 'shoulder bag', 'fanny pack',
    '包', '背包', '手提包', '书包', '斜挎包',
  ]},
  { name: 'Acessórios', keywords: [
    'belt', 'cinto', '皮带',
    'glasses', 'sunglasses', 'óculos', '眼镜',
    'hat', 'cap', 'boné', 'beanie', 'beret', '帽', '帽子',
    'socks', 'sock', 'meias', '袜',
    'scarf', 'cachecol', '围巾',
    'gloves', 'luvas', '手套',
    'wallet', 'carteira', '钱包',
    'jewelry', 'necklace', 'bracelet', 'earring', 'ring', 'brooch',
    'anel', 'colar', 'brinco', 'pulseira', 'broche',
    '项链', '耳环', '戒指',
    'keychain', 'chaveiro',
    'umbrella', 'guarda-chuva', '雨伞',
  ]},
  { name: 'Roupas', keywords: [
    'shirt', 't-shirt', 'tshirt', 'tee',
    'hoodie', 'sweatshirt', 'sweater', 'pullover', 'knitwear',
    'jacket', 'coat', 'parka', 'windbreaker', 'down jacket', 'overcoat',
    'jeans', 'pants', 'trousers', 'leggings', 'shorts', 'joggers',
    'dress', 'skirt', 'saia', 'vestido',
    'suit', 'terno', 'blazer', 'vest', 'waistcoat',
    'top', 'blouse', 'cardigan', 'polo',
    'pajamas', 'pijama', 'underwear', 'lingerie',
    'corteiz', 'essentials', 'fog ',
    '长袖', '短袖', '套装', '裤', '裙', '衣', '服', '衫', '外套', '羽绒服', '卫衣',
  ]},
  { name: 'Eletrônicos', keywords: [
    'speaker', 'bluetooth', 'earphone', 'headphone', 'earbuds', 'airpods',
    'cable', 'charger', 'powerbank', 'power bank', 'adapter',
    'keyboard', 'mouse', 'webcam', 'microphone',
    'phone case', 'case', 'capa', 'capinha',
    'fone', 'carregador', 'cabo',
    '音响', '耳机', '充电', '数据线',
    'a500', 'sound',
  ]},
  { name: 'Calçados', keywords: [
    'shoes', 'sneaker', 'sneakers', 'boot', 'boots', 'sandal', 'sandals',
    'tênis', 'sapatilha', 'sapato', 'chinelo', 'slipper', 'loafer', 'mule',
    'sport shoe', 'running shoe', 'trainer',
    '鞋', '靴', '拖鞋', '凉鞋',
  ]},
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
