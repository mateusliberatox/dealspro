/**
 * Registra o webhook do bot Telegram.
 * Lê credenciais do .env.local
 * Uso: node scripts/setup-telegram-webhook.mjs
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(process.cwd(), '.env.local');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=').map((p, i) => (i === 0 ? p.trim() : l.slice(l.indexOf('=') + 1).trim()))),
);

const TOKEN   = envVars.TELEGRAM_BOT_TOKEN;
const SECRET  = envVars.TELEGRAM_WEBHOOK_SECRET;
const SITE    = 'https://dealspro-chi.vercel.app';

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN não encontrado no .env.local');
  process.exit(1);
}

const webhookUrl = `${SITE}/api/telegram/webhook`;

const res = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify({
    url:                  webhookUrl,
    allowed_updates:      ['message'],
    secret_token:         SECRET || undefined,
    drop_pending_updates: true,
  }),
});

const data = await res.json();
if (data.ok) {
  console.log(`✓ Webhook registrado: ${webhookUrl}`);
} else {
  console.error(`✗ Erro: ${data.description}`);
}
