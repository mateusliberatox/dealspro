import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categorize } from '../categorize.js';

test('tênis → Calçados', () => {
  assert.equal(categorize('Nike Air Max sneakers'), 'Calçados');
});

test('hoodie → Roupas', () => {
  assert.equal(categorize('Supreme Hoodie 2024'), 'Roupas');
});

test('relógio inteligente → Smartwatch', () => {
  assert.equal(categorize('Apple Watch Series 9'), 'Smartwatch');
});

test('earphone → Eletrônicos', () => {
  assert.equal(categorize('Bluetooth Earphone TWS'), 'Eletrônicos');
});

test('bolsa → Bolsa / Mochila', () => {
  assert.equal(categorize('Leather Crossbody Bag'), 'Bolsa / Mochila');
});

test('smartwatch tem prioridade sobre Roupas (watch ≠ wrist watch no texto)', () => {
  assert.equal(categorize('Smart Watch fitness tracker'), 'Smartwatch');
});

test('usa nome traduzido como fallback', () => {
  assert.equal(categorize('蓝牙耳机', 'Bluetooth earphone'), 'Eletrônicos');
});

test('produto desconhecido → Outros', () => {
  assert.equal(categorize('Unknown Widget XYZ 9000'), 'Outros');
});

test('case insensitive', () => {
  assert.equal(categorize('RUNNING SHOES'), 'Calçados');
});
