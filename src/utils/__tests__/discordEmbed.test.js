import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscordEmbed, isValidImageUrl, truncate } from '../discordEmbed.js';

const base = {
  nome:           'Nike Air Max',
  nome_traduzido: 'Tênis Nike Air Max',
  preco:          '$29.99',
  link:           'https://cssdeals.com/?itemid=123',
  imagem:         'https://img.cssdeals.com/product/123.jpg',
  categoria:      'Calçados',
  sizes:          ['40', '41'],
};

test('título usa nome traduzido', () => {
  const embed = buildDiscordEmbed(base);
  assert.equal(embed.title, 'Tênis Nike Air Max');
});

test('url aponta para o link do produto', () => {
  assert.equal(buildDiscordEmbed(base).url, base.link);
});

test('campo de preço presente', () => {
  const embed = buildDiscordEmbed(base);
  assert.ok(embed.fields.some((f) => f.value.includes('$29.99')));
});

test('nome original vai para description quando há tradução diferente', () => {
  const embed = buildDiscordEmbed(base);
  assert.ok(embed.description?.includes('Nike Air Max'));
});

test('sem tradução: título usa nome original, sem description', () => {
  const p     = { ...base, nome_traduzido: null };
  const embed = buildDiscordEmbed(p);
  assert.equal(embed.title, 'Nike Air Max');
  assert.equal(embed.description, undefined);
});

test('nome igual ao traduzido: sem description', () => {
  const p     = { ...base, nome_traduzido: 'Nike Air Max' };
  const embed = buildDiscordEmbed(p);
  assert.equal(embed.description, undefined);
});

test('tamanhos aparecem no campo correspondente', () => {
  const embed      = buildDiscordEmbed(base);
  const sizesField = embed.fields.find((f) => f.name.includes('Tamanho'));
  assert.ok(sizesField);
  assert.ok(sizesField.value.includes('40'));
  assert.ok(sizesField.value.includes('41'));
});

test('imagem válida → embed.image preenchido', () => {
  assert.equal(buildDiscordEmbed(base).image?.url, base.imagem);
});

test('placeholder → embed.image ausente', () => {
  const p = { ...base, imagem: 'https://cssdeals.com/skin/img/product/27.jpg' };
  assert.equal(buildDiscordEmbed(p).image, undefined);
});

test('sem sizes → campo de tamanhos ausente', () => {
  const p    = { ...base, sizes: [] };
  const embed = buildDiscordEmbed(p);
  assert.ok(!embed.fields.some((f) => f.name.includes('Tamanho')));
});

// isValidImageUrl
test('URL válida → true', () => {
  assert.ok(isValidImageUrl('https://img.cssdeals.com/product/123.jpg'));
});

test('placeholder skin/img/product → false', () => {
  assert.ok(!isValidImageUrl('https://cssdeals.com/skin/img/product/27.jpg'));
});

test('null → false', () => {
  assert.ok(!isValidImageUrl(null));
});

test('URL com espaço → false', () => {
  assert.ok(!isValidImageUrl('https://example.com/image with space.jpg'));
});

test('URL HTTP é válida', () => {
  assert.ok(isValidImageUrl('http://img.example.com/photo.jpg'));
});

// truncate
test('string curta não é alterada', () => {
  assert.equal(truncate('abc', 10), 'abc');
});

test('string longa é cortada com reticências', () => {
  const result = truncate('abcdefghij', 5);
  assert.equal(result.length, 5);
  assert.ok(result.endsWith('…'));
});
