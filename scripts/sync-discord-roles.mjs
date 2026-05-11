/**
 * Atribui o cargo Premium do Discord a todos os usuários premium com Discord vinculado.
 * Lê credenciais do .env.local — nunca exponha secrets no código.
 * Uso: node scripts/sync-discord-roles.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Carrega .env.local manualmente (sem depender de dotenv instalado globalmente)
const envPath = resolve(process.cwd(), '.env.local');
const envVars = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => l.split('=').map((p, i) => (i === 0 ? p.trim() : l.slice(l.indexOf('=') + 1).trim()))),
);

const BOT_TOKEN  = envVars.DISCORD_BOT_TOKEN;
const GUILD_ID   = envVars.DISCORD_GUILD_ID;
const ROLE_ID    = envVars.DISCORD_PREMIUM_ROLE_ID;
const SUPA_URL   = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY   = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!BOT_TOKEN || !GUILD_ID || !ROLE_ID || !SUPA_URL || !SUPA_KEY) {
  console.error('❌ Variáveis ausentes no .env.local: DISCORD_BOT_TOKEN, DISCORD_GUILD_ID, DISCORD_PREMIUM_ROLE_ID, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPA_URL, SUPA_KEY);

const { data: users, error } = await supabase
  .from('dealspro_profiles')
  .select('discord_user_id, discord_username')
  .eq('plan', 'premium')
  .not('discord_user_id', 'is', null);

if (error) { console.error('Supabase error:', error.message); process.exit(1); }

console.log(`Encontrados ${users.length} usuários premium com Discord vinculado.\n`);

for (const u of users) {
  const res = await fetch(
    `https://discord.com/api/v10/guilds/${GUILD_ID}/members/${u.discord_user_id}/roles/${ROLE_ID}`,
    { method: 'PUT', headers: { Authorization: `Bot ${BOT_TOKEN}` } },
  );

  if (res.ok || res.status === 204) {
    console.log(`✓ ${u.discord_username} (${u.discord_user_id})`);
  } else {
    const body = await res.text();
    console.log(`✗ ${u.discord_username} (${u.discord_user_id}) — ${res.status}: ${body}`);
  }

  await new Promise(r => setTimeout(r, 600));
}

console.log('\nConcluído.');
