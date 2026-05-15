import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
}

// Sem timeout o fetch do Node.js pode travar por minutos quando o Supabase está instável.
// 30s é suficiente para qualquer query normal e falha rápido em caso de indisponibilidade.
const TIMEOUT_MS = 30_000;

function fetchWithTimeout(input, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(url, key, {
  global: { fetch: fetchWithTimeout },
});
