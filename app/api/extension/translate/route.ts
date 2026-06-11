// POST /api/extension/translate
// Traduz um termo de busca PT→ZH para uso no Taobao/Goofish.
// Stack: DeepL Free (se configurado) → MyMemory (fallback gratuito, sem chave).

import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited } from '@/lib/ratelimit';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

async function translateWithDeepL(text: string): Promise<string | null> {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch('https://api-free.deepl.com/v2/translate', {
      method:  'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: [text], source_lang: 'PT', target_lang: 'ZH' }),
      signal:  AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const json = await res.json() as { translations?: Array<{ text: string }> };
    return json?.translations?.[0]?.text?.trim() || null;
  } catch { return null; }
}

async function translateWithMyMemory(text: string): Promise<string | null> {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=pt-BR|zh-CN`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6_000) });
    if (!res.ok) return null;
    const json = await res.json() as { responseStatus?: number; responseData?: { translatedText?: string } };
    if (json?.responseStatus !== 200) return null;
    const translated = json?.responseData?.translatedText?.trim();
    return translated && translated !== text ? translated : null;
  } catch { return null; }
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (await isRateLimited(ip, 'extension')) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { ...CORS, 'Retry-After': '60' } },
    );
  }

  const { text } = await request.json().catch(() => ({})) as { text?: string };

  if (!text?.trim()) {
    return NextResponse.json({ error: 'text obrigatório' }, { status: 400, headers: CORS });
  }

  const input = text.trim();

  const translated =
    (await translateWithDeepL(input)) ??
    (await translateWithMyMemory(input));

  if (!translated) {
    return NextResponse.json({ error: 'Tradução indisponível' }, { status: 502, headers: CORS });
  }

  return NextResponse.json({ translated, original: input }, { headers: CORS });
}
