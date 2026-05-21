const HAS_CHINESE = /[一-鿿]/;
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

// Cache em memória: evita retraduzir o mesmo nome em ciclos consecutivos
// e protege a quota do MyMemory (~1000 palavras/dia por IP).
const translationCache = new Map();

/**
 * Translates a product name to Portuguese if it contains Chinese characters.
 * Uses MyMemory API (free, no key required, ~1000 words/day per IP).
 * Falls back to the original name on any error.
 */
export async function translateName(nome) {
  if (!HAS_CHINESE.test(nome)) return nome;

  if (translationCache.has(nome)) return translationCache.get(nome);

  try {
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(nome)}&langpair=zh-CN|pt-BR`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return nome;

    const json = await res.json();
    const translated = json?.responseData?.translatedText;

    if (!translated || translated === nome || json.responseStatus !== 200) return nome;

    translationCache.set(nome, translated);
    return translated;
  } catch {
    return nome;
  }
}
