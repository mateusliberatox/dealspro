import type { Product } from '../types.js';

/** Formata a mensagem HTML de um produto para o feed do Telegram. */
export function buildTelegramMessage(product: Product): string {
  const nome = product.nome_traduzido || product.nome;
  const cat  = product.categoria ? `📂 <b>${product.categoria}</b>\n` : '';
  return (
    `🛍️ <b>Novo deal!</b>\n\n` +
    cat +
    `📦 ${nome}\n` +
    `💰 <b>${product.preco || 'Ver no site'}</b>\n\n` +
    `<a href="${product.link}">👉 Abrir no CSSDeals</a>`
  );
}
