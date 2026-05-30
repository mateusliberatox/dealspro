import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/site';
import { effectivePlan } from '@/lib/plan';
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe';
import { registerTrackings, getTrackingUpdates, STATUS_LABELS, STATUS_EMOJI, STATUS_COLOR, hasApiTracking, getActiveProvider } from '@/lib/tracking';
import { sendBotDM } from '@/lib/discord';
import { NextRequest, NextResponse } from 'next/server';

// ── Singletons ─────────────────────────────────────────────────────────────────

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

// ── Utilitários ────────────────────────────────────────────────────────────────

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return bytes.buffer as ArrayBuffer;
}

async function verifySignature(request: NextRequest, body: string): Promise<boolean> {
  const sig = request.headers.get('x-signature-ed25519');
  const ts  = request.headers.get('x-signature-timestamp');
  const key = process.env.DISCORD_PUBLIC_KEY;
  if (!sig || !ts || !key) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', hexToBuffer(key),
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false, ['verify'],
    );
    return await crypto.subtle.verify('Ed25519', cryptoKey, hexToBuffer(sig), new TextEncoder().encode(ts + body));
  } catch { return false; }
}

const DISCORD_ID_RE = /^\d{17,19}$/;
function ephemeral(content: string) { return NextResponse.json({ type: 4, data: { content, flags: 64 } }); }
function embedReply(embeds: unknown[], flags = 64) { return NextResponse.json({ type: 4, data: { embeds, flags } }); }

// Limites de encomendas por plano (rastreamento é exclusivo Premium)
const ORDER_LIMIT = { free: 0, premium: 20 } as const;

// ── Handlers existentes ────────────────────────────────────────────────────────

async function handleAssinar(discordUserId: string) {
  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('user_id, plan, stripe_customer_id')
    .eq('discord_user_id', discordUserId)
    .single();

  if (!profile) {
    return ephemeral(
      '❌ **Conta não encontrada.**\n\n' +
      `Crie sua conta em ${SITE_URL} e vincule seu Discord em **Minha Conta** para usar este comando.`,
    );
  }
  if (profile.plan === 'premium') return ephemeral('⭐ Você já é **Premium**! Aproveite os benefícios exclusivos.');

  const session = await stripe.checkout.sessions.create({
    line_items:          [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    mode:                'subscription',
    client_reference_id: profile.user_id,
    customer:            profile.stripe_customer_id ?? undefined,
    success_url:         `${SITE_URL}/minha-conta`,
    cancel_url:          `${SITE_URL}/upgrade`,
  });

  return ephemeral(
    '🔗 **Seu link exclusivo para o DealsPro Premium:**\n\n' +
    `👉 [Assinar agora](${session.url})\n\n` +
    '*Somente você está vendo esta mensagem. Link válido por 24 horas.*',
  );
}

async function handleMeusAlertas(discordUserId: string) {
  const { data: profile } = await db
    .from('dealspro_profiles').select('user_id, plan').eq('discord_user_id', discordUserId).single();
  if (!profile) return ephemeral(`❌ Conta não encontrada. Crie a sua em ${SITE_URL}`);
  if (profile.plan !== 'premium') return ephemeral(`📦 **Plano Gratuito** — alertas são exclusivos para Premium.\n\nUse **/assinar** para ativar.`);

  const { data: alerts } = await db
    .from('user_alerts_dealspro').select('keyword, categoria, size, is_active')
    .eq('user_id', profile.user_id).eq('is_active', true).order('created_at', { ascending: false });

  if (!alerts?.length) return ephemeral(`🔔 Você não tem alertas ativos.\n\nCrie alertas em ${SITE_URL}/alerts`);

  const lines = (alerts as Array<{ keyword?: string; categoria?: string; size?: string }>).map((a, i) => {
    const parts = [a.keyword && `\`${a.keyword}\``, a.categoria, a.size].filter(Boolean);
    return `${i + 1}. ${parts.join(' · ')}`;
  });
  return ephemeral(`🔔 **Seus alertas ativos (${alerts.length}):**\n\n${lines.join('\n')}\n\nGerenciar: ${SITE_URL}/alerts`);
}

async function handleCancelar(discordUserId: string, keyword: string) {
  const { data: profile } = await db
    .from('dealspro_profiles').select('user_id').eq('discord_user_id', discordUserId).single();
  if (!profile) return ephemeral(`❌ Conta não encontrada.`);

  const { data: alert } = await db
    .from('user_alerts_dealspro').select('id, keyword')
    .eq('user_id', profile.user_id).eq('keyword', keyword).eq('is_active', true).single();
  if (!alert) return ephemeral(`❌ Nenhum alerta ativo encontrado com a keyword **"${keyword}"**.`);

  await db.from('user_alerts_dealspro').update({ is_active: false }).eq('id', alert.id);
  return ephemeral(`✅ Alerta **"${(alert as { keyword: string }).keyword}"** desativado com sucesso.`);
}

async function handleStatus(discordUserId: string) {
  const { data: profile } = await db
    .from('dealspro_profiles').select('plan, plan_expires_at, stripe_subscription_id')
    .eq('discord_user_id', discordUserId).single();
  if (!profile) return ephemeral(`❌ Conta não encontrada. Crie a sua em ${SITE_URL}`);

  const plan = effectivePlan(profile);
  if (plan === 'premium') {
    const expires = profile.plan_expires_at
      ? new Date(profile.plan_expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : null;
    return ephemeral(`⭐ **Plano Premium** — ativo\n` + (expires ? `🗓️ Renovação: ${expires}` : ''));
  }
  return ephemeral(`📦 **Plano Gratuito**\n\nUse **/assinar** para assinar o Premium e receber alertas instantâneos por DM.`);
}

// ── Rastreamento de encomendas ─────────────────────────────────────────────────

async function handleRastrear(discordUserId: string, trackingCode: string, description?: string) {
  const code = trackingCode.trim().toUpperCase();
  if (code.length < 5 || code.length > 40 || !/^[A-Z0-9]+$/i.test(code)) {
    return ephemeral('❌ Código de rastreamento inválido. Ex: `AB123456789BR` ou `CNXYZ123456`');
  }

  const { data: profile } = await db
    .from('dealspro_profiles').select('user_id, plan').eq('discord_user_id', discordUserId).single();
  if (!profile) return ephemeral(`❌ Conta não encontrada. Crie a sua em ${SITE_URL} e vincule seu Discord.`);

  // Rastreamento é exclusivo para Premium
  if (profile.plan !== 'premium') {
    return ephemeral(
      `🔒 **Rastreamento de encomendas é exclusivo para Premium.**\n\n` +
      `Use **/assinar** para assinar e rastrear até ${ORDER_LIMIT.premium} encomendas com notificações automáticas por DM.`,
    );
  }

  // Verifica limite de encomendas ativas
  const { count } = await db
    .from('user_orders').select('*', { count: 'exact', head: true })
    .eq('user_id', profile.user_id)
    .not('status', 'in', '("delivered","failed","returned")');

  if ((count ?? 0) >= ORDER_LIMIT.premium) {
    return ephemeral(
      `❌ Você já tem **${count}** encomendas ativas (limite: ${ORDER_LIMIT.premium}).\n\n` +
      `Remova ou aguarde a conclusão de uma antes de adicionar nova.`,
    );
  }

  // Verifica duplicata
  const { data: existing } = await db
    .from('user_orders').select('id, status').eq('user_id', profile.user_id).eq('tracking_code', code).single();
  if (existing) {
    const s = existing as { status: string };
    return ephemeral(`ℹ️ A encomenda \`${code}\` já está sendo rastreada.\n\nStatus atual: ${STATUS_EMOJI[s.status as keyof typeof STATUS_EMOJI]} ${STATUS_LABELS[s.status as keyof typeof STATUS_LABELS]}`);
  }

  // Registra no banco
  const { error: insertErr } = await db.from('user_orders').insert({
    user_id:       profile.user_id,
    tracking_code: code,
    description:   description?.trim() || null,
    status:        'pending',
  });
  if (insertErr) return ephemeral(`❌ Erro ao cadastrar encomenda: ${insertErr.message}`);

  // Registra no provider e já busca status inicial
  await registerTrackings([code]);
  const [info] = await getTrackingUpdates([code]);
  if (info && info.status !== 'pending') {
    await db.from('user_orders').update({
      status:          info.status,
      last_event:      info.lastEvent,
      last_event_at:   info.lastAt,
      last_checked_at: new Date().toISOString(),
    }).eq('user_id', profile.user_id).eq('tracking_code', code);
  }

  const currentStatus = info?.status ?? 'pending';
  const title         = description?.trim() || code;

  const PROVIDER_LABEL: Record<string, string> = {
    wonca: 'WONCA', trackingmore: 'TrackingMore',
    aftership: 'AfterShip', '17track': '17Track', correios: 'Correios',
  };
  const provider     = getActiveProvider();
  const providerName = PROVIDER_LABEL[provider] ?? provider;

  // Embed completo — usado tanto no DM quanto na resposta ephemeral do servidor
  const trackEmbed = {
    color:       STATUS_COLOR[currentStatus],
    title:       `${STATUS_EMOJI[currentStatus]} ${STATUS_LABELS[currentStatus]}`,
    description: `**${title}**`,
    fields: [
      { name: 'Código',  value: `\`${code}\``, inline: true },
      { name: 'Carrier', value: providerName,  inline: true },
      ...(info?.lastEvent ? [{ name: 'Último evento', value: info.lastEvent, inline: false }] : []),
    ],
    footer:    { text: 'Você receberá uma DM a cada mudança de status.' },
    timestamp: info?.lastAt ?? new Date().toISOString(),
  };

  // Envia DM com status inicial (await com timeout de 2s para não estourar o limite do Discord)
  await Promise.race([
    sendBotDM(discordUserId, { embeds: [trackEmbed] }),
    new Promise<void>((resolve) => setTimeout(resolve, 2000)),
  ]).catch(() => {});

  // Resposta ephemeral no servidor (só você vê)
  return embedReply([{
    color:       0x10b981,
    title:       '📦 Encomenda cadastrada!',
    description: `\`${code}\`${description ? ` — **${description.trim()}**` : ''}\n\nStatus atual enviado por DM. Você será notificado a cada atualização.`,
    footer:      { text: 'Somente você está vendo esta mensagem.' },
  }]);
}

async function handlePedidos(discordUserId: string) {
  const { data: profile } = await db
    .from('dealspro_profiles').select('user_id').eq('discord_user_id', discordUserId).single();
  if (!profile) return ephemeral(`❌ Conta não encontrada. Crie a sua em ${SITE_URL}`);

  const { data: orders } = await db
    .from('user_orders').select('tracking_code, description, status, last_event, last_event_at')
    .eq('user_id', profile.user_id)
    .order('created_at', { ascending: false })
    .limit(10);

  if (!orders?.length) {
    return ephemeral(`📦 Você não tem encomendas cadastradas.\n\nUse **/rastrear CÓDIGO** para começar a rastrear.`);
  }

  type OrderRow = { tracking_code: string; description?: string; status: string; last_event?: string; last_event_at?: string };
  const active    = (orders as OrderRow[]).filter((o) => !['delivered', 'failed', 'returned'].includes(o.status));
  const finalized = (orders as OrderRow[]).filter((o) =>  ['delivered', 'failed', 'returned'].includes(o.status));

  const format = (o: OrderRow) => {
    const emoji = STATUS_EMOJI[o.status as keyof typeof STATUS_EMOJI] ?? '📦';
    const label = STATUS_LABELS[o.status as keyof typeof STATUS_LABELS] ?? o.status;
    const name  = o.description ? `**${o.description}**` : `\`${o.tracking_code}\``;
    return `${emoji} ${name}\n└ \`${o.tracking_code}\` · ${label}`;
  };

  const embed = {
    color:  0x3b82f6,
    title:  `📦 Suas encomendas (${orders.length})`,
    fields: [
      ...(active.length    ? [{ name: `Em andamento (${active.length})`,   value: active.map(format).join('\n\n'),    inline: false }] : []),
      ...(finalized.length ? [{ name: `Finalizadas (${finalized.length})`, value: finalized.map(format).join('\n\n'), inline: false }] : []),
    ],
    footer: { text: `DealsPro · ${SITE_URL}/pedidos para ver detalhes` },
  };
  return embedReply([embed]);
}

async function handleRemoverPedido(discordUserId: string, trackingCode: string) {
  const code = trackingCode.trim().toUpperCase();
  const { data: profile } = await db
    .from('dealspro_profiles').select('user_id').eq('discord_user_id', discordUserId).single();
  if (!profile) return ephemeral(`❌ Conta não encontrada.`);

  const { data: order } = await db
    .from('user_orders').select('id, description')
    .eq('user_id', profile.user_id).eq('tracking_code', code).single();

  if (!order) return ephemeral(`❌ Encomenda \`${code}\` não encontrada nos seus pedidos.`);

  await db.from('user_orders').delete().eq('id', (order as { id: string }).id);
  const desc = (order as { description?: string }).description;
  return ephemeral(`✅ Encomenda ${desc ? `**${desc}**` : `\`${code}\``} removida do rastreamento.`);
}

async function handleAlterarDescricao(discordUserId: string, trackingCode: string, newDescription: string) {
  const code = trackingCode.trim().toUpperCase();
  const desc = newDescription.trim();

  if (!desc) return ephemeral('❌ A nova descrição não pode estar vazia.');
  if (desc.length > 100) return ephemeral('❌ A descrição deve ter no máximo 100 caracteres.');

  const { data: profile } = await db
    .from('dealspro_profiles').select('user_id').eq('discord_user_id', discordUserId).single();
  if (!profile) return ephemeral('❌ Conta não encontrada.');

  const { data: order } = await db
    .from('user_orders').select('id, description')
    .eq('user_id', profile.user_id).eq('tracking_code', code).single();

  if (!order) return ephemeral(`❌ Encomenda \`${code}\` não encontrada nos seus pedidos.`);

  await db.from('user_orders').update({ description: desc }).eq('id', (order as { id: string }).id);

  const old = (order as { description?: string }).description;
  return ephemeral(
    `✅ Descrição atualizada!\n\n` +
    `\`${code}\`\n` +
    (old ? `~~${old}~~ → ` : '') + `**${desc}**`,
  );
}

// ── Endpoint principal ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body  = await request.text();
  const valid = await verifySignature(request, body);
  if (!valid) return new NextResponse('Invalid signature', { status: 401 });

  const interaction = JSON.parse(body) as Record<string, unknown>;

  if (interaction.type === 1) return NextResponse.json({ type: 1 });

  if (interaction.type === 2) {
    const name          = interaction.data ? (interaction.data as Record<string, unknown>).name as string : '';
    const discordUserId = (interaction.member as Record<string, unknown> | undefined)?.user
      ? ((interaction.member as Record<string, unknown>).user as Record<string, unknown>).id as string
      : (interaction.user as Record<string, unknown> | undefined)?.id as string ?? '';

    if (!discordUserId || !DISCORD_ID_RE.test(discordUserId))
      return ephemeral('❌ Não foi possível identificar seu usuário.');

    const opts = (interaction.data as Record<string, unknown>)?.options as Array<Record<string, unknown>> | undefined;
    const opt  = (name: string) => opts?.find((o) => o.name === name)?.value as string | undefined;

    if (name === 'assinar')          return handleAssinar(discordUserId);
    if (name === 'status')           return handleStatus(discordUserId);
    if (name === 'meus-alertas')     return handleMeusAlertas(discordUserId);
    if (name === 'cancelar')         return handleCancelar(discordUserId, opt('keyword') ?? '');
    if (name === 'rastrear')           return handleRastrear(discordUserId, opt('codigo') ?? '', opt('descricao'));
    if (name === 'pedidos')            return handlePedidos(discordUserId);
    if (name === 'remover-pedido')     return handleRemoverPedido(discordUserId, opt('codigo') ?? '');
    if (name === 'alterar-descricao')  return handleAlterarDescricao(discordUserId, opt('codigo') ?? '', opt('descricao') ?? '');
  }

  return NextResponse.json({ type: 1 });
}
