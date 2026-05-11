/**
 * Registra os slash commands /assinar e /status no servidor Discord.
 * Execute uma vez: node scripts/register-discord-commands.mjs
 * Substitua APP_ID pelo Application ID do seu app no Discord Developer Portal.
 */

const BOT_TOKEN = 'COLE_SEU_BOT_TOKEN_AQUI';
const APP_ID    = '1500985388422926346';
const GUILD_ID  = '1499402192975560774';

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
