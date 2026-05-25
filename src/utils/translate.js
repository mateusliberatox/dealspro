import { supabase } from '../database/supabase.js';
import { logger } from './logger.js';

const HAS_CHINESE      = /[一-鿿]/;
const MYMEMORY_URL     = 'https://api.mymemory.translated.net/get';
const DEEPL_URL        = 'https://api-free.deepl.com/v2/translate';
const DEEPL_KEY        = process.env.DEEPL_API_KEY;

// Cache em memória: consulta rápida sem I/O — perdido no restart, repopulado pelo DB cache
const memCache    = new Map();
const MEM_CACHE_MAX = 2000;

// Quando a quota do MyMemory esgota, pausamos 1h antes de tentar novamente
let _quotaExhaustedAt = 0;
const QUOTA_COOLDOWN_MS = 60 * 60 * 1000;

// ── Camada 1: DB cache ────────────────────────────────────────────────────────

async function dbLookup(nome) {
  const { data } = await supabase
    .from('translation_cache')
    .select('nome_traduzido')
    .eq('nome_original', nome)
    .single();
  return data?.nome_traduzido ?? null;
}

function dbSave(nome, traduzido) {
  // Não-bloqueante — falha silenciosa (cache é oportunístico)
  supabase
    .from('translation_cache')
    .upsert({ nome_original: nome, nome_traduzido: traduzido }, { onConflict: 'nome_original', ignoreDuplicates: true })
    .catch(() => {});
}

// ── Camada 2: DeepL Free (500k chars/mês) ────────────────────────────────────

async function translateWithDeepL(nome) {
  if (!DEEPL_KEY) return null;
  try {
    const res = await fetch(DEEPL_URL, {
      method:  'POST',
      headers: { Authorization: `DeepL-Auth-Key ${DEEPL_KEY}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: [nome], source_lang: 'ZH', target_lang: 'PT-BR' }),
      signal:  AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      logger.warn(`DeepL error ${res.status} — fallback para MyMemory`);
      return null;
    }
    const json = await res.json();
    return json?.translations?.[0]?.text ?? null;
  } catch {
    return null;
  }
}

// ── Camada 3: MyMemory (fallback, 1000 palavras/dia grátis) ──────────────────

async function translateWithMyMemory(nome) {
  if (_quotaExhaustedAt && (Date.now() - _quotaExhaustedAt) < QUOTA_COOLDOWN_MS) return null;

  try {
    const url = `${MYMEMORY_URL}?q=${encodeURIComponent(nome)}&langpair=zh-CN|pt-BR`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    if (!res.ok) return null;

    const json    = await res.json();
    const status  = json?.responseStatus;
    const details = json?.responseDetails ?? '';

    if (status === 429 || status === 403 || /limit|quota|expired/i.test(details)) {
      if (!_quotaExhaustedAt) {
        logger.warn(
          `MyMemory: quota diária esgotada — traduções pausadas por 1h. ` +
          `Configure DEEPL_API_KEY para eliminar esse limite. Detalhes: ${details}`,
        );
      }
      _quotaExhaustedAt = Date.now();
      return null;
    }

    const translated = json?.responseData?.translatedText;
    if (!translated || translated === nome || status !== 200) return null;

    if (_quotaExhaustedAt) {
      _quotaExhaustedAt = 0;
      logger.info('MyMemory: quota restaurada — traduções reativadas');
    }

    return translated;
  } catch {
    return null;
  }
}

// ── Entrada pública ───────────────────────────────────────────────────────────

/**
 * Translates a Chinese product name to Portuguese.
 * Lookup order: memCache → DB cache → DeepL Free → MyMemory fallback.
 * Falls back to original name on any error.
 */
export async function translateName(nome) {
  if (!HAS_CHINESE.test(nome)) return nome;

  // 1. Memória (sem I/O)
  if (memCache.has(nome)) return memCache.get(nome);

  // 2. DB cache (persiste entre restarts do Railway)
  try {
    const cached = await dbLookup(nome);
    if (cached) {
      if (memCache.size >= MEM_CACHE_MAX) memCache.clear();
      memCache.set(nome, cached);
      return cached;
    }
  } catch { /* non-fatal */ }

  // 3. DeepL (se DEEPL_API_KEY configurada)
  let translated = await translateWithDeepL(nome);

  // 4. MyMemory como fallback
  if (!translated) translated = await translateWithMyMemory(nome);

  if (!translated || translated === nome) return nome;

  // Salva em memória e DB para próximas consultas
  if (memCache.size >= MEM_CACHE_MAX) memCache.clear();
  memCache.set(nome, translated);
  dbSave(nome, translated);

  return translated;
}
