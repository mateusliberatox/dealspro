/**
 * Testes E2E do pipeline de detecção de produtos.
 *
 * Cobre o fluxo completo de lógica pura — sem I/O — exercitando a integração
 * entre hash, classifyProducts, categorize e alertMatch com dados realistas.
 * Cada teste valida um caminho distinto que a função detectAndSaveNewProducts percorre.
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { generateProductHash } from '../../utils/hash.js';
import { classifyProducts } from '../../utils/productClassify.js';
import { categorize } from '../../utils/categorize.js';
import { productMatchesAlert } from '../../utils/alertMatch.js';

// ── Fixture helpers ────────────────────────────────────────────────────────────

function makeProduct(overrides = {}) {
  return {
    nome:             'Nike Air Force 1 sneakers',
    preco:            '$45.00',
    link:             'https://cssdeals.com/go.html?itemid=111',
    cssdeals_item_id: '111',
    isSoldOut:        false,
    ...overrides,
  };
}

function buildExistingMap(products) {
  const map = new Map();
  for (const p of products) {
    const hash = generateProductHash(p.nome, p.preco, p.link);
    map.set(hash, { id: p._id ?? 'uuid-existing', sizes: p.sizes ?? [], cssdeals_item_id: p.cssdeals_item_id ?? null });
  }
  return map;
}

function buildItemIdMap(products) {
  const map = new Map();
  for (const p of products) {
    if (p.cssdeals_item_id) {
      map.set(p.cssdeals_item_id, { id: p._id ?? 'uuid-existing' });
    }
  }
  return map;
}

// Replica a filtragem de candidatos do productService.js (linha 130)
function filterCandidates(withHashes, existingMap) {
  return withHashes.filter((p) => !existingMap.has(p.hash) && !p.isSoldOut);
}

// ── Testes ─────────────────────────────────────────────────────────────────────

describe('Pipeline: produto novo', () => {
  test('produto inédito passa por todo o pipeline como newItem', () => {
    const p     = makeProduct();
    const hash  = generateProductHash(p.nome, p.preco, p.link);
    const withHash = { ...p, hash };

    const existingMap   = new Map();
    const existingItemIdMap = new Map();
    const candidates    = filterCandidates([withHash], existingMap);
    const { newItems, priceChanged } = classifyProducts(candidates, existingItemIdMap);

    assert.equal(newItems.length, 1, 'deve ser classificado como novo');
    assert.equal(priceChanged.length, 0);
    assert.equal(newItems[0].hash, hash);
  });

  test('categoria é atribuída corretamente ao enriquecer', () => {
    const p        = makeProduct({ nome: 'Nike Air Force 1 sneakers running shoe' });
    const categoria = categorize(p.nome, 'Tênis Nike Air Force corrida');
    assert.equal(categoria, 'Calçados');
  });
});

describe('Pipeline: produto duplicado (dedup por hash)', () => {
  test('produto com mesmo hash é excluído dos candidatos', () => {
    const p    = makeProduct();
    const hash = generateProductHash(p.nome, p.preco, p.link);

    const existingMap = buildExistingMap([p]);
    const candidates  = filterCandidates([{ ...p, hash }], existingMap);

    assert.equal(candidates.length, 0, 'duplicata não deve entrar como candidato');
  });

  test('produto com mesmo hash, link e preço não gera nova notificação', () => {
    const p    = makeProduct();
    const hash = generateProductHash(p.nome, p.preco, p.link);

    const existingMap       = buildExistingMap([p]);
    const existingItemIdMap = buildItemIdMap([p]);
    const candidates        = filterCandidates([{ ...p, hash }], existingMap);
    const { newItems }      = classifyProducts(candidates, existingItemIdMap);

    assert.equal(newItems.length, 0);
  });
});

describe('Pipeline: mudança de preço', () => {
  test('mesmo item_id com preço diferente → priceChanged, não newItem', () => {
    const original = makeProduct({ preco: '$45.00', _id: 'uuid-1' });
    const updated  = makeProduct({ preco: '$39.00' }); // mesmo item_id, preço novo

    const hashOld = generateProductHash(original.nome, original.preco, original.link);
    const hashNew = generateProductHash(updated.nome, updated.preco, updated.link);

    // DB tem o produto com preço antigo
    const existingMap       = new Map([[hashOld, { id: 'uuid-1', sizes: [], cssdeals_item_id: '111' }]]);
    const existingItemIdMap = new Map([['111', { id: 'uuid-1' }]]);

    const candidates = filterCandidates([{ ...updated, hash: hashNew }], existingMap);
    assert.equal(candidates.length, 1, 'hash novo não está no mapa — entra como candidato');

    const { newItems, priceChanged } = classifyProducts(candidates, existingItemIdMap);
    assert.equal(newItems.length, 0, 'não deve ser tratado como produto novo');
    assert.equal(priceChanged.length, 1, 'deve ser detectado como mudança de preço');
    assert.equal(priceChanged[0].existingId, 'uuid-1');
  });

  test('mudança de preço não dispara notificação (produto já conhecido)', () => {
    const original = makeProduct({ preco: '$45.00', _id: 'uuid-2' });
    const updated  = makeProduct({ preco: '$29.00' });

    const hashOld = generateProductHash(original.nome, original.preco, original.link);
    const hashNew = generateProductHash(updated.nome, updated.preco, updated.link);

    const existingMap       = new Map([[hashOld, { id: 'uuid-2', sizes: [], cssdeals_item_id: '111' }]]);
    const existingItemIdMap = new Map([['111', { id: 'uuid-2' }]]);

    const candidates         = filterCandidates([{ ...updated, hash: hashNew }], existingMap);
    const { newItems }       = classifyProducts(candidates, existingItemIdMap);

    // newItems vazio = dispatchNotifications não seria chamado
    assert.equal(newItems.length, 0);
  });
});

describe('Pipeline: produto esgotado', () => {
  test('isSoldOut=true é removido dos candidatos antes do classifyProducts', () => {
    const p    = makeProduct({ isSoldOut: true });
    const hash = generateProductHash(p.nome, p.preco, p.link);

    const candidates = filterCandidates([{ ...p, hash }], new Map());
    assert.equal(candidates.length, 0, 'esgotado não deve entrar como candidato mesmo sendo inédito');
  });

  test('produto esgotado com hash existente também é excluído', () => {
    const p    = makeProduct({ isSoldOut: true });
    const hash = generateProductHash(p.nome, p.preco, p.link);

    const existingMap = buildExistingMap([p]);
    const candidates  = filterCandidates([{ ...p, hash }], existingMap);
    assert.equal(candidates.length, 0);
  });
});

describe('Pipeline: alertas personalizados', () => {
  test('alerta por keyword + categoria + size casa corretamente', () => {
    const product = {
      nome:           'Adidas Ultra Boost running sneakers',
      nome_traduzido: 'Tênis Adidas Ultra Boost corrida',
      categoria:      categorize('Adidas Ultra Boost running sneakers', 'Tênis Adidas Ultra Boost corrida'),
      sizes:          ['S', 'M', 'L', 'XL'],
    };
    assert.equal(product.categoria, 'Calçados');

    const alert = { keyword: 'adidas', categoria: 'Calçados', size: 'M' };
    assert.equal(productMatchesAlert(product, alert), true);
  });

  test('alerta não casa quando tamanho está fora do produto', () => {
    const product = {
      nome:      'Adidas Ultra Boost sneakers',
      categoria: 'Calçados',
      sizes:     ['S', 'M'],
    };
    const alert = { keyword: 'adidas', categoria: 'Calçados', size: 'XXL' };
    assert.equal(productMatchesAlert(product, alert), false);
  });

  test('alerta só por keyword casa independente de categoria', () => {
    const product = { nome: 'Supreme hoodie streetwear', nome_traduzido: 'moletom Supreme', categoria: 'Roupas', sizes: [] };
    const alert   = { keyword: 'supreme', categoria: null, size: null };
    assert.equal(productMatchesAlert(product, alert), true);
  });

  test('produto de categoria errada não aciona alerta com categoria definida', () => {
    const product = { nome: 'Nike sneakers shoes', categoria: 'Calçados', sizes: [] };
    const alert   = { keyword: 'nike', categoria: 'Roupas', size: null };
    assert.equal(productMatchesAlert(product, alert), false);
  });

  test('alerta sem keyword nem categoria nunca casa', () => {
    const product = { nome: 'qualquer produto', categoria: 'Outros', sizes: ['M'] };
    const alert   = { keyword: null, categoria: null, size: null };
    assert.equal(productMatchesAlert(product, alert), false);
  });
});

describe('Pipeline: integridade do hash', () => {
  test('hash é determinístico para a mesma entrada', () => {
    const h1 = generateProductHash('Nike Air Max', '$45.00', 'https://cssdeals.com/item?itemid=123');
    const h2 = generateProductHash('Nike Air Max', '$45.00', 'https://cssdeals.com/item?itemid=123');
    assert.equal(h1, h2);
  });

  test('variação de preço gera hash distinto (detecta mudança)', () => {
    const h1 = generateProductHash('Nike Air Max', '$45.00', 'https://cssdeals.com/item?itemid=123');
    const h2 = generateProductHash('Nike Air Max', '$39.00', 'https://cssdeals.com/item?itemid=123');
    assert.notEqual(h1, h2);
  });

  test('variação de espaços no nome não gera hash distinto (normalização)', () => {
    const h1 = generateProductHash('  Nike Air Max  ', '$45.00', 'https://cssdeals.com/item?itemid=123');
    const h2 = generateProductHash('nike air max', '$45.00', 'https://cssdeals.com/item?itemid=123');
    assert.equal(h1, h2);
  });

  test('dois produtos distintos nunca colidem', () => {
    const h1 = generateProductHash('Nike Air Max', '$45.00', 'https://cssdeals.com/item?itemid=123');
    const h2 = generateProductHash('Adidas Yeezy', '$120.00', 'https://cssdeals.com/item?itemid=456');
    assert.notEqual(h1, h2);
  });
});

describe('Pipeline: múltiplos produtos em lote', () => {
  test('lote misto: 1 novo, 1 duplicado, 1 preço alterado, 1 esgotado', () => {
    const novo      = makeProduct({ nome: 'New Balance 550', preco: '$60.00', link: 'https://cssdeals.com/go.html?itemid=222', cssdeals_item_id: '222' });
    const duplicado = makeProduct({ nome: 'Nike Air Force 1 sneakers', preco: '$45.00', link: 'https://cssdeals.com/go.html?itemid=111', cssdeals_item_id: '111', _id: 'uuid-dup' });
    const alterado  = makeProduct({ nome: 'Nike Air Force 1 sneakers', preco: '$38.00', link: 'https://cssdeals.com/go.html?itemid=111', cssdeals_item_id: '111' });
    const esgotado  = makeProduct({ nome: 'Puma Suede', preco: '$55.00', link: 'https://cssdeals.com/go.html?itemid=333', cssdeals_item_id: '333', isSoldOut: true });

    const hashNovo      = generateProductHash(novo.nome, novo.preco, novo.link);
    const hashDuplicado = generateProductHash(duplicado.nome, duplicado.preco, duplicado.link);
    const hashAlterado  = generateProductHash(alterado.nome, alterado.preco, alterado.link);
    const hashEsgotado  = generateProductHash(esgotado.nome, esgotado.preco, esgotado.link);

    const existingMap = new Map([
      [hashDuplicado, { id: 'uuid-dup', sizes: [], cssdeals_item_id: '111' }],
    ]);
    const existingItemIdMap = new Map([
      ['111', { id: 'uuid-dup' }],
    ]);

    const allWithHashes = [
      { ...novo,      hash: hashNovo },
      { ...duplicado, hash: hashDuplicado },
      { ...alterado,  hash: hashAlterado },
      { ...esgotado,  hash: hashEsgotado },
    ];

    const candidates = filterCandidates(allWithHashes, existingMap);
    // duplicado e esgotado excluídos; novo e alterado entram
    assert.equal(candidates.length, 2, 'duplicado e esgotado devem ser filtrados');

    const { newItems, priceChanged } = classifyProducts(candidates, existingItemIdMap);
    assert.equal(newItems.length, 1, 'só o produto realmente novo deve notificar');
    assert.equal(priceChanged.length, 1, 'mudança de preço deve ser detectada');
    assert.equal(newItems[0].cssdeals_item_id, '222');
    assert.equal(priceChanged[0].existingId, 'uuid-dup');
  });
});
