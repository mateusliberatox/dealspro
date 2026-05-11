/**
 * Registra os slash commands /assinar e /status no servidor Discord.
 * Lê credenciais do .env.local — nunca exponha secrets no código.
 * Uso: node scripts/register-discord-commands.mjs
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

const BOT_TOKEN = envVars.DISCORD_BOT_TOKEN;
const APP_ID    = envVars.DISCORD_APPLICATION_ID;
const GUILD_ID  = envVars.DISCORD_GUILD_ID;

if (!BOT_TOKEN || !APP_ID || !GUILD_ID) {
  console.error('❌ Variáveis ausentes no .env.local: DISCORD_BOT_TOKEN, DISCORD_APPLICATION_ID, DISCORD_GUILD_ID');
  process.exit(1);
}

const commands = [
  {
    name:        'assinar',
    description: 'Receba seu link exclusivo para assinar o DealsPro Premium',
  },
  {
    name:        'status',
    description: 'Veja seu status de assinatura no DealsPro',
  },
];

const res = await fetch(
  `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`,
  {
    method:  'PUT',
    headers: {
      Authorization:  `Bot ${BOT_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  },
);

if (res.ok) {
  const data = await res.json();
  console.log(`✓ ${data.length} comando(s) registrado(s):`);
  data.forEach((c) => console.log(`  /${c.name} — ${c.description}`));
} else {
  const err = await res.text();
  console.error(`✗ Erro (${res.status}): ${err}`);
}
