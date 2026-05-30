/**
 * Gerador de sugestão de declaração aduaneira via OpenAI gpt-4o-mini.
 * Se OPENAI_API_KEY não estiver configurada, usa fallback por regras.
 *
 * Não oferece garantia legal — apenas sugere descrições comuns para
 * importações pessoais via Correios.
 */

import OpenAI from 'openai';

export interface DeclarationSuggestion {
  descricao:    string;    // descrição simplificada (não-branded) em português
  categoria:    string;    // categoria do produto
  avisos:       string[];  // alertas relevantes
  valor_ok:     boolean;   // valor declarado parece razoável?
  via_ia:       boolean;   // true = OpenAI; false = regras
}

// ── Fallback por regras ───────────────────────────────────────────────────────

const CATEGORIAS: Array<{
  pattern: RegExp;
  categoria: string;
  descricao: string;
  avisos: string[];
}> = [
  {
    pattern:   /tênis|sneaker|nike|adidas|jordan|air max|yeezy|vans|converse|calçado|sapato|sandália/i,
    categoria: 'Calçados',
    descricao: 'Calçado esportivo',
    avisos:    ['Artigos de marca conhecida podem ser retidos para verificação de autenticidade.'],
  },
  {
    pattern:   /camiseta|camisa|blusa|moletom|hoodie|jaqueta|casaco|roupa|vestido|bermuda|short|calça|polo/i,
    categoria: 'Vestuário',
    descricao: 'Peça de vestuário',
    avisos:    ['Artigos de marca podem ser retidos. Prefira descrições genéricas.'],
  },
  {
    pattern:   /relógio|watch|smartwatch/i,
    categoria: 'Relógios',
    descricao: 'Relógio de pulso',
    avisos:    ['Relógios de marca são frequentemente taxados e retidos. Declare como "relógio" sem marca.'],
  },
  {
    pattern:   /fone|headphone|earphone|airpod|earbuds|fone de ouvido/i,
    categoria: 'Eletrônicos',
    descricao: 'Fone de ouvido',
    avisos:    ['Eletrônicos acima de US$ 50 podem ser tributados. Mantenha o valor declarado preciso.'],
  },
  {
    pattern:   /celular|smartphone|iphone|samsung|xiaomi|phone/i,
    categoria: 'Eletrônicos',
    descricao: 'Telefone celular',
    avisos:    ['Celulares são frequentemente tributados e inspecionados. Declare o valor real.', 'Pode ser necessário homologação ANATEL para liberação.'],
  },
  {
    pattern:   /bolsa|bag|mochila|carteira|wallet|pochete/i,
    categoria: 'Acessórios',
    descricao: 'Bolsa / acessório de moda',
    avisos:    ['Bolsas de marca são alvo comum de retenção por verificação de autenticidade.'],
  },
  {
    pattern:   /perfume|cologne|fragrance|eau de/i,
    categoria: 'Cosméticos',
    descricao: 'Perfume',
    avisos:    ['Perfumes são classificados como líquido inflamável — restrições de transporte aéreo podem se aplicar.'],
  },
  {
    pattern:   /brinquedo|toy|boneco|action figure|lego/i,
    categoria: 'Brinquedos',
    descricao: 'Brinquedo',
    avisos:    ['Brinquedos precisam de certificação INMETRO para comercialização — para uso pessoal, sem restrição.'],
  },
  {
    pattern:   /suplemento|whey|creatina|proteína|vitamina|supplement/i,
    categoria: 'Suplementos',
    descricao: 'Suplemento alimentar',
    avisos:    ['Suplementos podem ser retidos pela ANVISA para análise. Verifique se o produto é permitido no Brasil.'],
  },
];

const AVISOS_VALOR: Array<{ min: number; max: number; aviso: string }> = [
  { min: 0,   max: 50,  aviso: '' },
  { min: 50,  max: 300, aviso: 'Valor entre US$ 50 e US$ 300: pode incidir imposto de importação (60% + ICMS).' },
  { min: 300, max: Infinity, aviso: 'Valor acima de US$ 300: sujeito a despacho aduaneiro formal com tributação integral.' },
];

function fallbackAnalysis(produto: string, valorUsd: number): DeclarationSuggestion {
  const match = CATEGORIAS.find((c) => c.pattern.test(produto));
  const avisos = match ? [...match.avisos] : ['Descreva o produto de forma genérica, sem mencionar marcas.'];

  const avisoValor = AVISOS_VALOR.find((v) => valorUsd >= v.min && valorUsd < v.max)?.aviso ?? '';
  if (avisoValor) avisos.unshift(avisoValor);

  return {
    descricao: match?.descricao ?? 'Produto de uso pessoal',
    categoria: match?.categoria ?? 'Geral',
    avisos,
    valor_ok: valorUsd <= 300,
    via_ia:   false,
  };
}

// ── Análise via OpenAI ────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um especialista em importações pessoais pelo Correios para o Brasil.
Ajuda pessoas a entender como descrever produtos chineses na declaração aduaneira de forma precisa e sem marcas.
NÃO oferece garantias legais — apenas sugestões práticas baseadas em experiência comum.
Responda APENAS com JSON válido, sem markdown, sem explicações extras.`;

const USER_PROMPT = (produto: string, valor: number, qtd: number) =>
  `Produto: "${produto}"
Valor declarado: US$ ${valor.toFixed(2)}
Quantidade: ${qtd}

Retorne um JSON com exatamente estes campos:
{
  "descricao": "descrição genérica em português sem marca (máx 60 chars)",
  "categoria": "categoria do produto (ex: Calçados, Vestuário, Eletrônicos)",
  "avisos": ["array de avisos relevantes em português, máx 3 itens, strings curtas"],
  "valor_ok": true/false
}`;

export async function analyzeDeclaration(
  produto: string,
  valorUsd: number,
  quantidade: number = 1,
): Promise<DeclarationSuggestion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallbackAnalysis(produto, valorUsd);

  try {
    const client = new OpenAI({ apiKey });
    const resp = await client.chat.completions.create({
      model:       'gpt-4o-mini',
      temperature: 0.2,
      max_tokens:  300,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user',   content: USER_PROMPT(produto, valorUsd, quantidade) },
      ],
    });

    const raw = resp.choices[0]?.message?.content?.trim() ?? '';
    const parsed = JSON.parse(raw) as {
      descricao: string;
      categoria: string;
      avisos:    string[];
      valor_ok:  boolean;
    };

    // Adiciona aviso de valor se necessário
    const avisos = parsed.avisos ?? [];
    if (valorUsd > 50 && valorUsd <= 300 && !avisos.some((a) => a.includes('US$'))) {
      avisos.unshift('Valor entre US$ 50–300: pode incidir imposto de 60% + ICMS.');
    }
    if (valorUsd > 300) {
      avisos.unshift('Valor acima de US$ 300: sujeito a despacho aduaneiro formal.');
    }

    return {
      descricao: parsed.descricao,
      categoria: parsed.categoria,
      avisos:    avisos.slice(0, 3),
      valor_ok:  parsed.valor_ok,
      via_ia:    true,
    };
  } catch {
    return fallbackAnalysis(produto, valorUsd);
  }
}
