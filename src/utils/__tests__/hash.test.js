import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateProductHash } from '../hash.js';

test('mesmas entradas produzem o mesmo hash', () => {
  const h1 = generateProductHash('Nike Air Max', '$99.99', 'https://cssdeals.com/?itemid=123');
  const h2 = generateProductHash('Nike Air Max', '$99.99', 'https://cssdeals.com/?itemid=123');
  assert.equal(h1, h2);
});

test('preço diferente gera hash diferente', () => {
  const h1 = generateProductHash('Nike Air Max', '$99.99', 'https://cssdeals.com/?itemid=123');
  const h2 = generateProductHash('Nike Air Max', '$89.99', 'https://cssdeals.com/?itemid=123');
  assert.notEqual(h1, h2);
});

test('link diferente gera hash diferente', () => {
  const h1 = generateProductHash('Nike Air Max', '$99.99', 'https://cssdeals.com/?itemid=123');
  const h2 = generateProductHash('Nike Air Max', '$99.99', 'https://cssdeals.com/?itemid=456');
  assert.notEqual(h1, h2);
});

test('nome é normalizado: trim + lowercase antes do hash', () => {
  const h1 = generateProductHash('Nike Air Max', '$99.99', 'https://cssdeals.com/?itemid=123');
  const h2 = generateProductHash('  NIKE AIR MAX  ', '$99.99', 'https://cssdeals.com/?itemid=123');
  assert.equal(h1, h2);
});

test('espaços no preço são ignorados', () => {
  const h1 = generateProductHash('Produto', '$9.99', 'https://cssdeals.com/?itemid=1');
  const h2 = generateProductHash('Produto', '$ 9 . 9 9', 'https://cssdeals.com/?itemid=1');
  assert.equal(h1, h2);
});

test('retorna string hex de 64 caracteres (SHA-256)', () => {
  const h = generateProductHash('test', '$10', 'https://example.com');
  assert.match(h, /^[0-9a-f]{64}$/);
});
