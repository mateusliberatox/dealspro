/**
 * Gerador de declaração aduaneira para importações pessoais via Correios.
 * Suporta múltiplos itens, conversão Yuan→USD e análise por IA (gpt-4o-mini).
 * Não oferece garantia legal — apenas sugestões práticas.
 */

import OpenAI from 'openai';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface DeclarationItem {
  produto:    string;   // nome original informado pelo usuário
  descricao:  string;   // descrição simplificada (não-branded) sugerida pela IA
  cor:        string;
  tamanho:    string;
  quantidade: number;
}

export interface DeclarationSession {
  id:              string;
  total_value_usd: number;
  original_value:  number;
  moeda:           'usd' | 'yuan';
  items:           DeclarationItem[];
}

// ── Conversão de moeda ────────────────────────────────────────────────────────

const CNY_USD_FALLBACK = 0.138; // ≈ 1 CNY = $0.138 USD (fallback fixo)

export async function convertToUsd(amount: number, moeda: 'usd' | 'yuan'): Promise<number> {
  if (moeda === 'usd') return amount;
  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/CNY', { signal: AbortSignal.timeout(4_000) });
    const data = await res.json() as { rates?: Record<string, number> };
    const rate = data.rates?.USD ?? CNY_USD_FALLBACK;
    return parseFloat((amount * rate).toFixed(2));
  } catch {
    return parseFloat((amount * CNY_USD_FALLBACK).toFixed(2));
  }
}

// ── Análise de produto via IA ─────────────────────────────────────────────────

const SYSTEM_PROMPT =
  'Você é especialista em importações pessoais pelo Correios para o Brasil. ' +
  'Sugere descrições genéricas e sem marca para declarações aduaneiras. ' +
  'Responda APENAS com JSON válido, sem markdown.';

export async function analyzeProduct(produto: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return inferDescription(produto);

  try {
    const client = new OpenAI({ apiKey });
    const resp   = await client.chat.completions.create({
      model:       'gpt-4o-mini',
      temperature: 0.1,
      max_tokens:  60,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: `Produto: "${produto}". Retorne {"descricao": "descrição genérica sem marca em português, máx 40 chars"}` },
      ],
    });
    const raw    = resp.choices[0]?.message?.content?.trim() ?? '';
    const parsed = JSON.parse(raw) as { descricao: string };
    return parsed.descricao || inferDescription(produto);
  } catch {
    return inferDescription(produto);
  }
}

function inferDescription(produto: string): string {
  const p = produto.toLowerCase();
  if (/tênis|sneaker|nike|adidas|jordan|yeezy|vans|calçado|sapato/.test(p)) return 'Calçado esportivo';
  if (/sandália|chinelo|tamanco/.test(p))                                    return 'Calçado casual';
  if (/camiseta|camisa|blusa|polo/.test(p))                                  return 'Camiseta';
  if (/moletom|hoodie|casaco|jaqueta/.test(p))                               return 'Peça de agasalho';
  if (/calça|jeans|short|bermuda/.test(p))                                   return 'Peça de vestuário inferior';
  if (/vestido|saia/.test(p))                                                return 'Vestido / saia';
  if (/bolsa|mochila|bag/.test(p))                                           return 'Bolsa';
  if (/carteira|wallet/.test(p))                                             return 'Carteira';
  if (/relógio|watch/.test(p))                                               return 'Relógio de pulso';
  if (/fone|headphone|earphone|earbuds/.test(p))                             return 'Fone de ouvido';
  if (/celular|smartphone|phone/.test(p))                                    return 'Telefone celular';
  if (/óculos/.test(p))                                                      return 'Óculos';
  if (/cinto|belt/.test(p))                                                  return 'Cinto';
  return 'Artigo de uso pessoal';
}

// ── Geração do texto de declaração ───────────────────────────────────────────

export function buildDeclarationText(session: DeclarationSession): string {
  if (!session.items.length) return '';

  const totalQty   = session.items.reduce((s, i) => s + i.quantidade, 0);
  const valueEach  = session.total_value_usd / (totalQty || 1);

  const COL = { attr: 28, produto: 22, qtd: 5, valor: 12 };
  const pad  = (s: string, n: number) => s.slice(0, n).padEnd(n);
  const line = (a: string, p: string, q: string, v: string) =>
    `| ${pad(a, COL.attr)} | ${pad(p, COL.produto)} | ${pad(q, COL.qtd)} | ${pad(v, COL.valor)} |`;

  const sep  = `+${'-'.repeat(COL.attr + 2)}+${'-'.repeat(COL.produto + 2)}+${'-'.repeat(COL.qtd + 2)}+${'-'.repeat(COL.valor + 2)}+`;
  const rows = session.items.map((item) => {
    const attrs  = [item.cor && `Cor: ${item.cor}`, item.tamanho && `Tam: ${item.tamanho}`].filter(Boolean).join(' / ') || '-';
    const itemVal = `$${(valueEach * item.quantidade).toFixed(2)} USD`;
    return line(attrs, item.descricao, String(item.quantidade), itemVal);
  });

  const header = line('Atributos', 'Produto', 'Qtd', 'Preço Total');
  const total  = `Total: $${session.total_value_usd.toFixed(2)} USD` +
    (session.moeda === 'yuan' ? ` (¥${session.original_value})` : '');

  return ['```', sep, header, sep, ...rows, sep, '', total, '```'].join('\n');
}

// ── Embed de estado da sessão ─────────────────────────────────────────────────

export function buildSessionEmbed(session: DeclarationSession) {
  const totalQty  = session.items.reduce((s, i) => s + i.quantidade, 0);
  const valueEach = session.total_value_usd / (totalQty || 1);
  const valorStr  = session.moeda === 'yuan'
    ? `$${session.total_value_usd.toFixed(2)} USD (¥${session.original_value})`
    : `$${session.total_value_usd.toFixed(2)} USD`;

  const itemLines = session.items.map((item, i) => {
    const attrs   = [item.cor && `Cor: ${item.cor}`, item.tamanho && `Tam: ${item.tamanho}`].filter(Boolean).join(' · ');
    const itemVal = (valueEach * item.quantidade).toFixed(2);
    return `**${i + 1}.** ${item.descricao} × ${item.quantidade}${attrs ? ` _(${attrs})_` : ''} — $${itemVal}`;
  });

  return {
    color:       0x3b82f6,
    title:       '📋 Declaração em andamento',
    description: itemLines.length
      ? itemLines.join('\n')
      : '_Nenhum item ainda. Clique em **Adicionar produto**._',
    fields: [{ name: 'Valor total declarado', value: valorStr, inline: true }],
    footer: { text: 'Sugestão — não é garantia de liberação pela Receita Federal.' },
  };
}

export function buildSessionComponents(sessionId: string, hasItems: boolean) {
  return [{
    type: 1,
    components: [
      { type: 2, style: 1, label: '➕ Adicionar produto', custom_id: `decl_add:${sessionId}` },
      ...(hasItems ? [{ type: 2, style: 3, label: '📋 Gerar declaração', custom_id: `decl_gen:${sessionId}` }] : []),
      { type: 2, style: 4, label: '🗑️ Descartar', custom_id: `decl_discard:${sessionId}` },
    ],
  }];
}
