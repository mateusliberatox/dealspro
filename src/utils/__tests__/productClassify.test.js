import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyProducts } from '../productClassify.js';

test('produto sem cssdeals_item_id → newItems', () => {
  const candidates = [{ nome: 'Produto A', hash: 'abc', cssdeals_item_id: null }];
  const { newItems, priceChanged } = classifyProducts(candidates, new Map());
  assert.equal(newItems.length, 1);
  assert.equal(priceChanged.length, 0);
});

test('produto com item_id inexistente no mapa → newItems', () => {
  const candidates = [{ cssdeals_item_id: '999', hash: 'h1' }];
  const { newItems, priceChanged } = classifyProducts(candidates, new Map());
  assert.equal(newItems.length, 1);
  assert.equal(priceChanged.length, 0);
});

test('produto com item_id já no mapa → priceChanged', () => {
  const candidates  = [{ cssdeals_item_id: '123', hash: 'novo', preco: '$9' }];
  const existingMap = new Map([['123', { id: 'db-id-1', sizes: [] }]]);
  const { newItems, priceChanged } = classifyProducts(candidates, existingMap);
  assert.equal(newItems.length, 0);
  assert.equal(priceChanged.length, 1);
  assert.equal(priceChanged[0].existingId, 'db-id-1');
  assert.equal(priceChanged[0].item.preco, '$9');
});

test('mistura: existente (preço) + novo (sem id) + novo (id inédito)', () => {
  const candidates = [
    { cssdeals_item_id: '111', hash: 'h1' },
    { cssdeals_item_id: null,  hash: 'h2' },
    { cssdeals_item_id: '999', hash: 'h3' },
  ];
  const existingMap = new Map([['111', { id: 'db-1', sizes: [] }]]);
  const { newItems, priceChanged } = classifyProducts(candidates, existingMap);
  assert.equal(newItems.length, 2);
  assert.equal(priceChanged.length, 1);
});

test('lista vazia retorna arrays vazios', () => {
  const { newItems, priceChanged } = classifyProducts([], new Map());
  assert.equal(newItems.length, 0);
  assert.equal(priceChanged.length, 0);
});
