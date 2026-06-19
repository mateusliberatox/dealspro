import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
}

// Sem timeout o fetch do Node.js pode travar por minutos quando o Supabase está instável.
// 15s é suficiente para todas as queries do monitor (simples, < 1s no happy-path);
// reduz o pior caso do fast-cycle de ~62s para ~32s quando o DB está fora do ar.
const TIMEOUT_MS = 15_000;

function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  return fetch(input as RequestInfo, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export const supabase = createClient(url, key, {
  global: { fetch: fetchWithTimeout as typeof fetch },
});
