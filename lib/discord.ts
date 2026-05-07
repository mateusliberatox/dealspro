const DISCORD_API = 'https://discord.com/api/v10';

function token()  { return process.env.DISCORD_BOT_TOKEN; }
function guild()  { return process.env.DISCORD_GUILD_ID; }
function roleId() { return process.env.DISCORD_PREMIUM_ROLE_ID; }

/**
 * Adiciona o cargo premium ao usuário no servidor Discord.
 * Silencioso se não estiver configurado ou se o usuário não estiver no servidor.
 */
export async function addPremiumRole(discordUserId: string): Promise<void> {
  if (!token() || !guild() || !roleId()) {
    console.warn('[Discord] addPremiumRole ignorado — DISCORD_BOT_TOKEN, DISCORD_GUILD_ID ou DISCORD_PREMIUM_ROLE_ID não configurados no Vercel.');
    return;
  }
  const res = await fetch(
    `${DISCORD_API}/guilds/${guild()}/members/${discordUserId}/roles/${roleId()}`,
    { method: 'PUT', headers: { Authorization: `Bot ${token()}` } },
  );
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => '');
    console.warn(`[Discord] addPremiumRole falhou (${res.status}): ${body}`);
  }
}

/**
 * Remove o cargo premium do usuário no servidor Discord.
 * Silencioso se não estiver configurado.
 */
export async function removePremiumRole(discordUserId: string): Promise<void> {
  if (!token() || !guild() || !roleId()) return;
  const res = await fetch(
    `${DISCORD_API}/guilds/${guild()}/members/${discordUserId}/roles/${roleId()}`,
    { method: 'DELETE', headers: { Authorization: `Bot ${token()}` } },
  );
  if (!res.ok && res.status !== 204) {
    const body = await res.text().catch(() => '');
    console.warn(`[Discord] removePremiumRole falhou (${res.status}): ${body}`);
  }
}

/**
 * Envia uma DM via bot. Lança erro se falhar.
 */
export async function sendBotDM(
  discordUserId: string,
  payload: { content?: string; embeds?: unknown[] },
): Promise<void> {
  const t = token();
  if (!t) throw new Error('DISCORD_BOT_TOKEN não configurado');

  // Abre canal de DM
  const channelRes = await fetch(`${DISCORD_API}/users/@me/channels`, {
    method: 'POST',
    headers: { Authorization: `Bot ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient_id: discordUserId }),
  });

  if (!channelRes.ok) {
    const err = await channelRes.text();
    throw new Error(`Canal DM falhou (${channelRes.status}): ${err}`);
  }

  const { id: channelId } = await channelRes.json();

  // Envia mensagem
  const msgRes = await fetch(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bot ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!msgRes.ok) {
    const err = await msgRes.text();
    throw new Error(`DM falhou (${msgRes.status}): ${err}`);
  }
}
