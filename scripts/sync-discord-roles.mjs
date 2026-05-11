/**
 * Atribui o cargo Premium do Discord a todos os usuários premium com Discord vinculado.
 * Requer no .env.local: DISCORD_BOT_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const BOT_TOKEN  = 'COLE_SEU_BOT_TOKEN_AQUI';
const GUILD_ID   = '1499402192975560774';
const ROLE_ID    = '1501612900819800145';
const SUPA_URL   = 'https://ktgypsgwxumdobakyebn.supabase.co';
const SUPA_KEY   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0Z3lwc2d3eHVtZG9iYWt5ZWJuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU0NzM0NCwiZXhwIjoyMDkwMTIzMzQ0fQ.37LURsu6GjKcxYAlgb0LhPXKlqx3FApgKmLk-EHtSrQ';

const supabase = createClient(SUPA_URL, SUPA_KEY);

const { data: users } = await supabase
  .from('dealspro_profiles')
  .select('discord_user_id, discord_username')
  .eq('plan', 'premium')
  .not('discord_user_id', 'is', null);

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

  await new Promise(r => setTimeout(r, 500));
}

console.log('\nConcluído.');
