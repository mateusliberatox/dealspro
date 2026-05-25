import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTelegramMessage } from '../telegramMessage.js';

const base = {
  nome:           'Nike Air Max',
  nome_traduzido: 'Tênis Nike Air Max',
  preco:          '$29.99',
  link:           'https://cssdeals.com/?itemid=123',
  categoria:      'Calçados',
};

test('usa nome traduzido quando disponível', () => {
  const msg = buildTelegramMessage(base);
  assert.ok(msg.includes('Tênis Nike Air Max'));
  // linha do produto deve conter o nome traduzido, não o original isolado
  assert.ok(msg.includes('📦 Tênis Nike Air Max'));
});

test('usa nome original quando não há tradução', () => {
  const msg = buildTelegramMessage({ ...base, nome_traduzido: null });
  assert.ok(msg.includes('Nike Air Max'));
});

test('contém o preço', () => {
  assert.ok(buildTelegramMessage(base).includes('$29.99'));
});

test('contém o link do produto', () => {
  assert.ok(buildTelegramMessage(base).includes('https://cssdeals.com/?itemid=123'));
});

test('contém a categoria', () => {
  assert.ok(buildTelegramMessage(base).includes('Calçados'));
});

test('sem categoria: linha de categoria ausente', () => {
  const msg = buildTelegramMessage({ ...base, categoria: null });
  assert.ok(!msg.includes('📂'));
});

test('preço ausente: mostra "Ver no site"', () => {
  const msg = buildTelegramMessage({ ...base, preco: '' });
  assert.ok(msg.includes('Ver no site'));
});

test('formato HTML válido: tags abertas são fechadas', () => {
  const msg = buildTelegramMessage(base);
  const opens  = (msg.match(/<b>/g)  ?? []).length;
  const closes = (msg.match(/<\/b>/g) ?? []).length;
  assert.equal(opens, closes);
});
