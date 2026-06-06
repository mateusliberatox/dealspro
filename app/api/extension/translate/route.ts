// POST /api/extension/translate
// Traduz um termo de busca PT→ZH para uso no Taobao/Goofish.
// Sem autenticação — custo mínimo (gpt-4o-mini, ~0.001 USD por busca).

import { NextRequest, NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  const { text } = await request.json().catch(() => ({})) as { text?: string };

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text obrigatório' }, { status: 400, headers: CORS });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI não configurado' }, { status: 500, headers: CORS });
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 80,
      messages: [{
        role:    'user',
        content: `Translate this product search query from Portuguese to Simplified Chinese. Return ONLY the Chinese translation, no explanation, no quotes: "${text.trim()}"`,
      }],
    }),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    return NextResponse.json({ error: 'OpenAI falhou' }, { status: 502, headers: CORS });
  }

  const data  = await res.json() as { choices: Array<{ message: { content: string } }> };
  const translated = data.choices?.[0]?.message?.content?.trim();

  if (!translated) {
    return NextResponse.json({ error: 'Tradução vazia' }, { status: 502, headers: CORS });
  }

  return NextResponse.json({ translated, original: text.trim() }, { headers: CORS });
}
