import { logger } from './logger.js';

const HAS_CHINESE = /[一-鿿]/;
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

// Cache em memória: evita retraduzir o mesmo nome em ciclos consecutivos
// e protege a quota do MyMemory (~1000 palavras/dia por IP).
// Limite de 2000 entradas — evita memory leak em processos Railway de longa duração.
const translationCache = new Map();
const CACHE_MAX = 2000;

// Quando a quota diária esgota, pausamos 1h antes de tentar novamente
let _quotaExhaustedAt = 0;
const QUOTA_COOLDOWN_MS = 60 * 60 * 1000;

/**
 * Translates a product name to Portuguese if it contains Chinese characters.
 * Uses MyMemory API (free, no key required, ~1000 words/day per IP).
 * Falls back to the original name on any error or quota exhaustion.
 */
export async function translateName(nome) {
  if (!HAS_CHINESE.test(nome)) return nome;

  if (translationCache.has(nome)) return translationCache.get(nome);

  // Quota esgotada — espera o cooldown antes de tentar novamente
  if (_quotaExhaustedAt && (Date.now() - _quotaExhaustedAt) < QUOTA_COOLDOWN_MS) return nome;

  if (translationCache.size >= CACHE_MAX) translationCache.clear();

  try {
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(nome)}&langpair=zh-CN|pt-BR`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return nome;

    const json = await res.json();
    const status  = json?.responseStatus;
    const details = json?.responseDetails ?? '';

    // Detecta esgotamento de quota (429, 403 ou mensagem de limite)
    if (status === 429 || status === 403 || /limit|quota|expired/i.test(details)) {
      if (!_quotaExhaustedAt) {
        logger.warn(
          `MyMemory: quota diária esgotada — traduções pausadas por 1h. ` +
          `Considere migrar para DeepL Free (500k chars/mês). Detalhes: ${details}`,
        );
      }
      _quotaExhaustedAt = Date.now();
      return nome;
    }

    const translated = json?.responseData?.translatedText;
    if (!translated || translated === nome || status !== 200) return nome;

    // Quota ok — reseta flag caso estivesse setada
    if (_quotaExhaustedAt) {
      _quotaExhaustedAt = 0;
      logger.info('MyMemory: quota restaurada — traduções reativadas');
    }

    translationCache.set(nome, translated);
    return translated;
  } catch {
    return nome;
  }
}
