import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/site';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

// ── Utilitários ────────────────────────────────────────────────────────────────

function hexToBuffer(hex: string): ArrayBuffer {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes.buffer as ArrayBuffer;
}

async function verifySignature(request: NextRequest, body: string): Promise<boolean> {
  const sig = request.headers.get('x-signature-ed25519');
  const ts  = request.headers.get('x-signature-timestamp');
  const key = process.env.DISCORD_PUBLIC_KEY;
  if (!sig || !ts || !key) return false;

  // Rejeita timestamps com mais de 5 minutos (replay attack)
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  try {
    const cryptoKey = await crypto.subtle.importKey(
      'raw', hexToBuffer(key),
      { name: 'Ed25519', namedCurve: 'Ed25519' },
      false, ['verify'],
    );
    return await crypto.subtle.verify(
      'Ed25519', cryptoKey,
      hexToBuffer(sig),
      new TextEncoder().encode(ts + body),
    );
  } catch { return false; }
}

const DISCORD_ID_RE = /^\d{17,19}$/;

function ephemeral(content: string) {
  return NextResponse.json({ type: 4, data: { content, flags: 64 } });
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

// ── Handlers dos comandos ──────────────────────────────────────────────────────

async function handleAssinar(discordUserId: string) {
  const db = admin();

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

  if (profile.plan === 'premium') {
    return ephemeral('⭐ Você já é **Premium**! Aproveite os benefícios exclusivos.');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await stripe.checkout.sessions.create({
    line_items:           [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    mode:                 'subscription',
    client_reference_id:  profile.user_id,
    customer:             profile.stripe_customer_id ?? undefined,
    success_url:          `${SITE_URL}/minha-conta`,
    cancel_url:           `${SITE_URL}/upgrade`,
  });

  return ephemeral(
    '🔗 **Seu link exclusivo para o DealsPro Premium:**\n\n' +
    `👉 [Assinar agora](${session.url})\n\n` +
    '*Somente você está vendo esta mensagem. Link válido por 24 horas.*',
  );
}

async function handleMeusAlertas(discordUserId: string) {
  const db = admin();

  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('user_id, plan')
    .eq('discord_user_id', discordUserId)
    .single();

  if (!profile) return ephemeral(`❌ Conta não encontrada. Crie a sua em ${SITE_URL}`);
  if (profile.plan !== 'premium') return ephemeral(`📦 **Plano Gratuito** — alertas são exclusivos para Premium.\n\nUse **/assinar** para ativar.`);

  const { data: alerts } = await db
    .from('user_alerts_dealspro')
    .select('keyword, categoria, size, is_active')
    .eq('user_id', profile.user_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!alerts?.length) return ephemeral(`🔔 Você não tem alertas ativos.\n\nCrie alertas em ${SITE_URL}/alerts`);

  const lines = alerts.map((a, i) => {
    const parts = [a.keyword && `\`${a.keyword}\``, a.categoria, a.size].filter(Boolean);
    return `${i + 1}. ${parts.join(' · ')}`;
  });

  return ephemeral(`🔔 **Seus alertas ativos (${alerts.length}):**\n\n${lines.join('\n')}\n\nGerenciar: ${SITE_URL}/alerts`);
}

async function handleCancelar(discordUserId: string, keyword: string) {
  const db = admin();

  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('user_id')
    .eq('discord_user_id', discordUserId)
    .single();

  if (!profile) return ephemeral(`❌ Conta não encontrada.`);

  const { data: alert } = await db
    .from('user_alerts_dealspro')
    .select('id, keyword')
    .eq('user_id', profile.user_id)
    .ilike('keyword', keyword)
    .eq('is_active', true)
    .single();

  if (!alert) return ephemeral(`❌ Nenhum alerta ativo encontrado com a keyword **"${keyword}"**.`);

  await db
    .from('user_alerts_dealspro')
    .update({ is_active: false })
    .eq('id', alert.id);

  return ephemeral(`✅ Alerta **"${alert.keyword}"** desativado com sucesso.`);
}

async function handleStatus(discordUserId: string) {
  const db = admin();

  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('plan, plan_expires_at')
    .eq('discord_user_id', discordUserId)
    .single();

  if (!profile) {
    return ephemeral(
      `❌ Conta não encontrada. Crie a sua em ${SITE_URL}`,
    );
  }

  if (profile.plan === 'premium') {
    const expires = profile.plan_expires_at
      ? new Date(profile.plan_expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : null;
    return ephemeral(
      `⭐ **Plano Premium** — ativo\n` +
      (expires ? `🗓️ Renovação: ${expires}` : ''),
    );
  }

  return ephemeral(
    `📦 **Plano Gratuito**\n\nUse **/assinar** para assinar o Premium e receber alertas instantâneos por DM.`,
  );
}

// ── Endpoint principal ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const body = await request.text();

  const valid = await verifySignature(request, body);
  if (!valid) return new NextResponse('Invalid signature', { status: 401 });

  const interaction = JSON.parse(body);

  // PING — verificação do Discord
  if (interaction.type === 1) {
    return NextResponse.json({ type: 1 });
  }

  // Slash commands
  if (interaction.type === 2) {
    const name           = interaction.data?.name as string;
    const discordUserId: string =
      interaction.member?.user?.id ?? interaction.user?.id ?? '';

    if (!discordUserId || !DISCORD_ID_RE.test(discordUserId))
      return ephemeral('❌ Não foi possível identificar seu usuário.');

    if (name === 'assinar')       return handleAssinar(discordUserId);
    if (name === 'status')        return handleStatus(discordUserId);
    if (name === 'meus-alertas')  return handleMeusAlertas(discordUserId);
    if (name === 'cancelar') {
      const keyword = (interaction.data?.options?.[0]?.value as string) ?? '';
      if (!keyword) return ephemeral('❌ Informe a keyword do alerta. Ex: `/cancelar hoodie`');
      return handleCancelar(discordUserId, keyword);
    }
  }

  return NextResponse.json({ type: 1 });
}
