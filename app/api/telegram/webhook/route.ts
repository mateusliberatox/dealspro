import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const SITE_URL = 'https://dealspro-chi.vercel.app';

type NotifyMode = 'alerts_only' | 'all_deals' | 'both';

const MODE_LABELS: Record<NotifyMode, string> = {
  alerts_only: '🔔 Somente alertas configurados',
  all_deals:   '📦 Todos os deals (respeitando seu plano)',
  both:        '🔔📦 Alertas + todos os deals',
};

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function reply(chatId: number, text: string) {
  await sendTelegramMessage(chatId, text).catch(() => {});
}

// ── /start ────────────────────────────────────────────────────────────────────

async function handleStart(chatId: number, username: string | undefined, payload: string) {
  const db = admin();

  if (payload) {
    const { data: profile } = await db
      .from('dealspro_profiles')
      .select('user_id, telegram_chat_id')
      .eq('referral_code', payload)
      .single();

    if (!profile) {
      return reply(chatId,
        `❌ Código inválido.\n\nAcesse <a href="${SITE_URL}/minha-conta">Minha Conta</a> e clique em "Vincular Telegram".`
      );
    }
    if (profile.telegram_chat_id === chatId) {
      return reply(chatId, '✅ Sua conta já está vinculada ao DealsPro!');
    }

    await db
      .from('dealspro_profiles')
      .update({ telegram_chat_id: chatId, telegram_username: username ?? null })
      .eq('user_id', profile.user_id);

    return reply(chatId,
      '✅ <b>Conta DealsPro vinculada!</b>\n\n' +
      'Você pode receber alertas e deals por aqui.\n\n' +
      'Comandos disponíveis:\n' +
      '/status — seu plano\n' +
      '/alertas — seus alertas\n' +
      '/feed — ativar/desativar feed de deals\n' +
      '/modo — modo de notificação\n' +
      '/assinar — assinar o Premium\n' +
      '/cancelar [keyword] — desativar alerta'
    );
  }

  return reply(chatId,
    '👋 <b>Bem-vindo ao DealsPro!</b>\n\n' +
    `Para vincular sua conta acesse:\n<a href="${SITE_URL}/minha-conta">${SITE_URL}/minha-conta</a>\n\n` +
    'E clique em <b>Vincular Telegram</b>.'
  );
}

// ── /assinar ──────────────────────────────────────────────────────────────────

async function handleAssinar(chatId: number) {
  const db = admin();
  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('user_id, plan, stripe_customer_id')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) {
    return reply(chatId, `❌ Conta não encontrada.\n\nAcesse ${SITE_URL}/minha-conta e vincule seu Telegram.`);
  }
  if (profile.plan === 'premium') {
    return reply(chatId, '⭐ Você já é <b>Premium</b>! Aproveite os benefícios exclusivos.');
  }

  const stripe  = new Stripe(process.env.STRIPE_SECRET_KEY!);
  const coupon  = process.env.STRIPE_FIRST_MONTH_COUPON;
  // Coupon só para quem nunca assinou antes (stripe_customer_id null = primeira vez)
  const applyDiscount = coupon && !profile.stripe_customer_id;
  const session = await stripe.checkout.sessions.create({
    line_items:          [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    mode:                'subscription',
    client_reference_id: profile.user_id,
    customer:            profile.stripe_customer_id ?? undefined,
    success_url:         `${SITE_URL}/minha-conta`,
    cancel_url:          `${SITE_URL}/upgrade`,
    ...(applyDiscount ? { discounts: [{ coupon }] } : {}),
  });

  return reply(chatId,
    '🔗 <b>Seu link exclusivo para o DealsPro Premium:</b>\n\n' +
    `👉 <a href="${session.url}">Assinar agora</a>\n\n` +
    '<i>Somente você está vendo esta mensagem. Link válido por 24 horas.</i>'
  );
}

// ── /status ───────────────────────────────────────────────────────────────────

async function handleStatus(chatId: number) {
  const db = admin();
  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('plan, plan_expires_at, telegram_notify_mode')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) {
    return reply(chatId, `❌ Conta não encontrada.\n\nAcesse ${SITE_URL}/minha-conta e vincule seu Telegram.`);
  }

  const mode = MODE_LABELS[(profile.telegram_notify_mode as NotifyMode)] ?? MODE_LABELS.alerts_only;

  if (profile.plan === 'premium') {
    const expires = profile.plan_expires_at
      ? new Date(profile.plan_expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : null;
    return reply(chatId,
      `⭐ <b>Plano Premium</b> — ativo\n` +
      (expires ? `🗓 Renovação: ${expires}\n` : '') +
      `\n📬 Modo: ${mode}`
    );
  }

  return reply(chatId,
    `📦 <b>Plano Gratuito</b>\n` +
    `📬 Modo: ${mode}\n\n` +
    `Use /assinar para obter o Premium.`
  );
}

// ── /alertas ──────────────────────────────────────────────────────────────────

async function handleAlertas(chatId: number) {
  const db = admin();
  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('user_id, plan')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) return reply(chatId, `❌ Conta não encontrada. Acesse ${SITE_URL}/minha-conta`);
  if (profile.plan !== 'premium') {
    return reply(chatId, `📦 Alertas por keyword são exclusivos do Premium.\n\n/assinar para ativar.`);
  }

  const { data: alerts } = await db
    .from('user_alerts_dealspro')
    .select('keyword, categoria, size, is_active')
    .eq('user_id', profile.user_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!alerts?.length) {
    return reply(chatId, `🔔 Nenhum alerta ativo.\n\nCrie em ${SITE_URL}/alerts`);
  }

  const lines = alerts.map((a, i) => {
    const parts = [a.keyword && `<code>${a.keyword}</code>`, a.categoria, a.size].filter(Boolean);
    return `${i + 1}. ${parts.join(' · ')}`;
  });

  return reply(chatId,
    `🔔 <b>Seus alertas ativos (${alerts.length}):</b>\n\n${lines.join('\n')}\n\n` +
    `Gerenciar: ${SITE_URL}/alerts`
  );
}

// ── /cancelar ─────────────────────────────────────────────────────────────────

async function handleCancelar(chatId: number, keyword: string) {
  const db = admin();
  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) return reply(chatId, '❌ Conta não vinculada.');

  const { data: alert } = await db
    .from('user_alerts_dealspro')
    .select('id, keyword')
    .eq('user_id', profile.user_id)
    .ilike('keyword', keyword)
    .eq('is_active', true)
    .single();

  if (!alert) return reply(chatId, `❌ Nenhum alerta ativo com a keyword "${keyword}".`);

  await db.from('user_alerts_dealspro').update({ is_active: false }).eq('id', alert.id);
  return reply(chatId, `✅ Alerta "<b>${alert.keyword}</b>" desativado.`);
}

// ── /feed ─────────────────────────────────────────────────────────────────────

async function handleFeed(chatId: number) {
  const db = admin();
  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('user_id, plan, telegram_notify_mode')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) return reply(chatId, `❌ Conta não vinculada. Acesse ${SITE_URL}/minha-conta`);

  const current = (profile.telegram_notify_mode as NotifyMode) ?? 'alerts_only';

  // Toggle: se feed está ativo, desativa; se não, ativa
  let next: NotifyMode;
  if (current === 'alerts_only') {
    next = profile.plan === 'premium' ? 'both' : 'all_deals';
  } else if (current === 'all_deals') {
    next = 'alerts_only';
  } else {
    next = 'alerts_only'; // both → alerts_only
  }

  await db
    .from('dealspro_profiles')
    .update({ telegram_notify_mode: next })
    .eq('user_id', profile.user_id);

  const feedAtivo = next !== 'alerts_only';
  return reply(chatId,
    feedAtivo
      ? `✅ <b>Feed de deals ativado!</b>\n\n${MODE_LABELS[next]}\n\n<i>Use /feed novamente para desativar.</i>`
      : `🔕 <b>Feed desativado.</b>\n\nVocê receberá apenas alertas configurados.\n\n<i>Use /feed para reativar.</i>`
  );
}

// ── /modo ─────────────────────────────────────────────────────────────────────

async function handleModo(chatId: number, arg: string) {
  const db = admin();
  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('user_id, plan, telegram_notify_mode')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) return reply(chatId, `❌ Conta não vinculada.`);

  const validModes: NotifyMode[] = ['alerts_only', 'all_deals', 'both'];

  if (arg && validModes.includes(arg as NotifyMode)) {
    const next = arg as NotifyMode;
    await db
      .from('dealspro_profiles')
      .update({ telegram_notify_mode: next })
      .eq('user_id', profile.user_id);
    return reply(chatId, `✅ Modo atualizado para: ${MODE_LABELS[next]}`);
  }

  const current = (profile.telegram_notify_mode as NotifyMode) ?? 'alerts_only';
  return reply(chatId,
    `📬 <b>Modo atual:</b> ${MODE_LABELS[current]}\n\n` +
    `<b>Modos disponíveis:</b>\n` +
    `• /modo alerts_only — só alertas configurados\n` +
    `• /modo all_deals — todos os deals\n` +
    `• /modo both — alertas + todos os deals\n\n` +
    `Ou use /feed para ativar/desativar o feed rapidamente.`
  );
}

// ── Endpoint principal ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-telegram-bot-api-secret-token');
  if (process.env.TELEGRAM_WEBHOOK_SECRET && secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ ok: true }); }

  const message = body?.message as Record<string, unknown> | undefined;
  if (!message) return NextResponse.json({ ok: true });

  const chatId   = (message.chat as Record<string, unknown>)?.id as number;
  const username = (message.from as Record<string, unknown>)?.username as string | undefined;
  const text     = (message.text as string) ?? '';

  if (!chatId || !text.startsWith('/')) return NextResponse.json({ ok: true });

  const parts   = text.trim().split(/\s+/);
  const cmdBase = (parts[0] ?? '').split('@')[0];
  const arg     = parts.slice(1).join(' ');

  switch (cmdBase) {
    case '/start':   await handleStart(chatId, username, arg); break;
    case '/assinar': await handleAssinar(chatId); break;
    case '/status':  await handleStatus(chatId); break;
    case '/alertas': await handleAlertas(chatId); break;
    case '/cancelar':
      if (!arg) await reply(chatId, '❌ Informe a keyword. Ex: /cancelar hoodie');
      else      await handleCancelar(chatId, arg);
      break;
    case '/feed': await handleFeed(chatId); break;
    case '/modo': await handleModo(chatId, arg); break;
    default:
      await reply(chatId,
        '📋 <b>Comandos disponíveis:</b>\n\n' +
        '/assinar — assinar o Premium\n' +
        '/status — seu plano atual\n' +
        '/alertas — seus alertas ativos\n' +
        '/cancelar [keyword] — desativar alerta\n' +
        '/feed — ativar/desativar feed de deals\n' +
        '/modo — configurar modo de notificação\n\n' +
        `<a href="${SITE_URL}">Acessar o site</a>`
      );
  }

  return NextResponse.json({ ok: true });
}
