import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productMatchesAlert } from '../alertMatch.js';

const base = {
  nome:           'Nike Air Max Sneaker',
  nome_traduzido: 'Tênis Nike Air Max',
  categoria:      'Calçados',
  sizes:          ['40', '41', '42'],
};

test('alerta por keyword casa', () => {
  assert.ok(productMatchesAlert(base, { keyword: 'nike', categoria: null, size: null }));
});

test('alerta por keyword não casa', () => {
  assert.ok(!productMatchesAlert(base, { keyword: 'adidas', categoria: null, size: null }));
});

test('alerta por categoria casa', () => {
  assert.ok(productMatchesAlert(base, { keyword: null, categoria: 'Calçados', size: null }));
});

test('alerta por categoria não casa', () => {
  assert.ok(!productMatchesAlert(base, { keyword: null, categoria: 'Roupas', size: null }));
});

test('keyword + categoria: ambos devem casar', () => {
  assert.ok(productMatchesAlert(base, { keyword: 'nike', categoria: 'Calçados', size: null }));
});

test('keyword + categoria: keyword bate mas categoria não', () => {
  assert.ok(!productMatchesAlert(base, { keyword: 'nike', categoria: 'Roupas', size: null }));
});

test('keyword + categoria: categoria bate mas keyword não', () => {
  assert.ok(!productMatchesAlert(base, { keyword: 'adidas', categoria: 'Calçados', size: null }));
});

test('tamanho presente na lista → casa', () => {
  assert.ok(productMatchesAlert(base, { keyword: 'nike', categoria: null, size: '41' }));
});

test('tamanho ausente na lista → não casa', () => {
  assert.ok(!productMatchesAlert(base, { keyword: 'nike', categoria: null, size: '45' }));
});

test('size é case-insensitive', () => {
  const p = { ...base, sizes: ['XL', 'XXL'] };
  assert.ok(productMatchesAlert(p, { keyword: 'nike', categoria: null, size: 'xl' }));
});

test('alerta sem keyword nem categoria → nunca casa', () => {
  assert.ok(!productMatchesAlert(base, { keyword: null, categoria: null, size: null }));
});

test('usa nome_traduzido para keyword match', () => {
  assert.ok(productMatchesAlert(base, { keyword: 'tênis', categoria: null, size: null }));
});

test('produto sem sizes e alerta com size → não casa', () => {
  const p = { ...base, sizes: [] };
  assert.ok(!productMatchesAlert(p, { keyword: 'nike', categoria: null, size: 'M' }));
});
