import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { log } from '@/lib/log';

const DISCORD_API = 'https://discord.com/api/v10';

function token()  { return process.env.DISCORD_BOT_TOKEN; }
function guild()  { return process.env.DISCORD_GUILD_ID; }
function roleId() { return process.env.DISCORD_PREMIUM_ROLE_ID; }

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function enqueueRoleSync(discordUserId: string, action: 'add' | 'remove', err: string) {
  await admin()
    .from('discord_role_sync')
    .insert({ discord_user_id: discordUserId, action, status: 'pending', last_error: err })
    .then(({ error }) => {
      if (error) log.error('discord_enqueue_failed', { discordUserId, action, error: error.message });
    });
}

async function callRoleApi(discordUserId: string, action: 'add' | 'remove'): Promise<{ ok: boolean; status: number; body?: string }> {
  if (!token() || !guild() || !roleId()) {
    return { ok: false, status: 0, body: 'discord_env_missing' };
  }
  const method = action === 'add' ? 'PUT' : 'DELETE';
  const res = await fetch(
    `${DISCORD_API}/guilds/${guild()}/members/${discordUserId}/roles/${roleId()}`,
    { method, headers: { Authorization: `Bot ${token()}` } },
  );
  if (res.ok || res.status === 204) return { ok: true, status: res.status };
  const body = await res.text().catch(() => '');
  return { ok: false, status: res.status, body };
}

export type RoleSyncOutcome = 'ok' | 'queued' | 'env-missing';

/**
 * Adiciona o cargo premium. Tenta uma vez; se falhar, enfileira para retry pelo cron.
 * Nunca lança — para ser seguro em fluxos críticos de pagamento.
 * Retorna o desfecho para que callers (como o sync admin) possam reportar com precisão.
 */
export async function addPremiumRole(discordUserId: string): Promise<RoleSyncOutcome> {
  if (!token() || !guild() || !roleId()) {
    log.warn('discord_env_missing', { action: 'add', discordUserId });
    return 'env-missing';
  }
  const r = await callRoleApi(discordUserId, 'add').catch((e) => ({ ok: false, status: 0, body: String(e) }));
  if (r.ok) return 'ok';
  log.warn('discord_add_role_failed', { discordUserId, status: r.status, body: r.body });
  await enqueueRoleSync(discordUserId, 'add', `${r.status}:${r.body}`);
  return 'queued';
}

/**
 * Remove o cargo premium. Mesma estratégia: tenta uma vez, enfileira no fracasso.
 */
export async function removePremiumRole(discordUserId: string): Promise<RoleSyncOutcome> {
  if (!token() || !guild() || !roleId()) {
    log.warn('discord_env_missing', { action: 'remove', discordUserId });
    return 'env-missing';
  }
  const r = await callRoleApi(discordUserId, 'remove').catch((e) => ({ ok: false, status: 0, body: String(e) }));
  if (r.ok) return 'ok';
  log.warn('discord_remove_role_failed', { discordUserId, status: r.status, body: r.body });
  await enqueueRoleSync(discordUserId, 'remove', `${r.status}:${r.body}`);
  return 'queued';
}

/**
 * Processador de retry — chamado pelo cron. Pega até `limit` items pendentes
 * com attempts < max_attempts, tenta a operação, atualiza status.
 *
 * Marca como 'failed' quando esgota tentativas (não tenta de novo — fica para auditoria).
 */
export async function processRoleSyncQueue(db: SupabaseClient, limit = 20): Promise<{ done: number; failed: number; retried: number }> {
  const { data: pending } = await db
    .from('discord_role_sync')
    .select('id, discord_user_id, action, attempts, max_attempts')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(limit);

  if (!pending || pending.length === 0) return { done: 0, failed: 0, retried: 0 };

  let done = 0, failed = 0, retried = 0;
  for (const item of pending) {
    const r = await callRoleApi(item.discord_user_id, item.action as 'add' | 'remove')
      .catch((e) => ({ ok: false, status: 0, body: String(e) }));

    const newAttempts = item.attempts + 1;
    if (r.ok) {
      await db.from('discord_role_sync').update({ status: 'done', attempts: newAttempts, last_error: null }).eq('id', item.id);
      done++;
    } else if (newAttempts >= item.max_attempts) {
      await db.from('discord_role_sync').update({ status: 'failed', attempts: newAttempts, last_error: `${r.status}:${r.body}` }).eq('id', item.id);
      log.error('discord_sync_exhausted', { discordUserId: item.discord_user_id, action: item.action, status: r.status });
      failed++;
    } else {
      await db.from('discord_role_sync').update({ attempts: newAttempts, last_error: `${r.status}:${r.body}` }).eq('id', item.id);
      retried++;
    }
  }
  return { done, failed, retried };
}

/**
 * Envia uma DM via bot. Lança erro se falhar (usado em fluxos onde o erro deve subir).
 */
export async function sendBotDM(
  discordUserId: string,
  payload: { content?: string; embeds?: unknown[] },
): Promise<void> {
  const t = token();
  if (!t) throw new Error('DISCORD_BOT_TOKEN não configurado');

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
