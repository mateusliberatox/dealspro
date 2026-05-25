export const CATEGORY_EMOJI = {
  'Roupas':          '👕',
  'Calçados':        '👟',
  'Bolsa / Mochila': '👜',
  'Acessórios':      '🕶️',
  'Smartwatch':      '⌚',
  'Eletrônicos':     '🔊',
  'Outros':          '📦',
};

const COLOR = 0xf97316;

export const truncate = (str, max) => str.length > max ? str.slice(0, max - 1) + '…' : str;

export function isValidImageUrl(url) {
  if (!url || url.includes(' ')) return false;
  try {
    const { protocol } = new URL(url);
    return (protocol === 'http:' || protocol === 'https:') &&
      !/placeholder|800.?x.?900|via\.placeholder|picsum|skin\/img\/product\/\d+/i.test(url);
  } catch { return false; }
}

export function buildDiscordEmbed(p) {
  const nome      = p.nome_traduzido || p.nome;
  const original  = p.nome_traduzido && p.nome_traduzido !== p.nome ? p.nome : null;
  const emoji     = CATEGORY_EMOJI[p.categoria] ?? '📦';
  const categoria = p.categoria ?? 'Outros';

  const embed = {
    color:  COLOR,
    author: { name: `${emoji}  ${categoria.toUpperCase()}  •  cssdeals.com` },
    title:  truncate(nome, 200),
    url:    p.link,
    fields: [
      { name: '💰 Preço',   value: `**${p.preco || 'Ver no site'}**`, inline: true },
      { name: '🛒 Comprar', value: `[Abrir produto](${p.link})`,      inline: true },
    ],
    footer:    { text: 'DealsPro • cssdeals.com' },
    timestamp: new Date().toISOString(),
  };

  if (original) embed.description = `*Nome original: ${truncate(original, 150)}*`;

  if (isValidImageUrl(p.imagem)) embed.image = { url: p.imagem };

  if (p.sizes?.length) {
    embed.fields.push({ name: '📐 Tamanhos', value: p.sizes.join(' · '), inline: false });
  }

  return embed;
}
