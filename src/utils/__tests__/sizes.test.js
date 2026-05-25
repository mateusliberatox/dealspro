import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSizes } from '../sizes.js';

test('tamanhos básicos separados por vírgula', () => {
  assert.deepEqual(parseSizes('S,M,L,XL'), ['S', 'M', 'L', 'XL']);
});

test('2XL e 3XL normalizados para XXL e XXXL', () => {
  const sizes = parseSizes('2XL,3XL');
  assert.ok(sizes.includes('XXL'));
  assert.ok(sizes.includes('XXXL'));
});

test('tamanhos numéricos (numeração europeia)', () => {
  assert.deepEqual(parseSizes('40,41,42,43'), ['40', '41', '42', '43']);
});

test('tamanhos com meia numeração (.5)', () => {
  const sizes = parseSizes('40.5,41.5');
  assert.ok(sizes.includes('40.5'));
  assert.ok(sizes.includes('41.5'));
});

test('prefixo chinês "尺寸:" é removido', () => {
  assert.deepEqual(parseSizes('尺寸:S/M/L'), ['S', 'M', 'L']);
});

test('separador ponto-e-vírgula', () => {
  assert.deepEqual(parseSizes('S;M;L'), ['S', 'M', 'L']);
});

test('tokens de cor são ignorados', () => {
  const sizes = parseSizes('颜色:Red,Blue,尺寸:S,M,L');
  assert.ok(sizes.includes('S'));
  assert.ok(sizes.includes('M'));
  assert.ok(sizes.includes('L'));
  assert.ok(!sizes.includes('Red'));
  assert.ok(!sizes.includes('Blue'));
});

test('texto vazio retorna array vazio', () => {
  assert.deepEqual(parseSizes(''), []);
});

test('null retorna array vazio', () => {
  assert.deepEqual(parseSizes(null), []);
});

test('sem duplicatas no resultado', () => {
  const sizes = parseSizes('S,S,M,M,L');
  assert.equal(sizes.filter((s) => s === 'S').length, 1);
  assert.equal(sizes.filter((s) => s === 'M').length, 1);
});
