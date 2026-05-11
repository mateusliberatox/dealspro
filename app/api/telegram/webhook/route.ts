import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram';
import { NextRequest, NextResponse } from 'next/server';

const SITE_URL = 'https://dealspro-chi.vercel.app';

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function reply(chatId: number, text: string) {
  await sendTelegramMessage(chatId, text).catch(() => {});
}

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleStart(chatId: number, username: string | undefined, payload: string) {
  const db = admin();

  if (payload) {
    // payload = referral_code do usuário no site → vincula a conta
    const { data: profile } = await db
      .from('dealspro_profiles')
      .select('user_id, telegram_chat_id')
      .eq('referral_code', payload)
      .single();

    if (!profile) {
      return reply(chatId,
        '❌ Código inválido.\n\nAcesse <a href="' + SITE_URL + '/minha-conta">Minha Conta</a> e clique em "Vincular Telegram" para obter seu link.'
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
      '✅ <b>Conta DealsPro vinculada com sucesso!</b>\n\n' +
      'Você agora receberá alertas por aqui quando um produto com sua palavra-chave aparecer.\n\n' +
      `<i>Use /status para ver seu plano ou acesse ${SITE_URL}</i>`
    );
  }

  // Sem payload: boas-vindas genérico
  return reply(chatId,
    '👋 <b>Bem-vindo ao DealsPro!</b>\n\n' +
    'Para vincular sua conta e receber alertas, acesse:\n' +
    `<a href="${SITE_URL}/minha-conta">${SITE_URL}/minha-conta</a>\n\n` +
    'E clique em <b>Vincular Telegram</b>.'
  );
}

async function handleStatus(chatId: number) {
  const db = admin();
  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('plan, plan_expires_at')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) {
    return reply(chatId,
      `❌ Conta não encontrada.\n\nAcesse ${SITE_URL}/minha-conta e clique em "Vincular Telegram".`
    );
  }

  if (profile.plan === 'premium') {
    const expires = profile.plan_expires_at
      ? new Date(profile.plan_expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : null;
    return reply(chatId,
      `⭐ <b>Plano Premium</b> — ativo\n` +
      (expires ? `🗓 Renovação: ${expires}` : '')
    );
  }

  return reply(chatId,
    `📦 <b>Plano Gratuito</b>\n\nAssine o Premium para receber alertas por aqui:\n${SITE_URL}/upgrade`
  );
}

async function handleMeusAlertas(chatId: number) {
  const db = admin();
  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('user_id, plan')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) return reply(chatId, `❌ Conta não vinculada. Acesse ${SITE_URL}/minha-conta`);
  if (profile.plan !== 'premium') return reply(chatId, `📦 Alertas são exclusivos do Premium.\n\n${SITE_URL}/upgrade`);

  const { data: alerts } = await db
    .from('user_alerts_dealspro')
    .select('keyword, categoria, size, is_active')
    .eq('user_id', profile.user_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!alerts?.length) return reply(chatId, `🔔 Nenhum alerta ativo.\n\nCrie em ${SITE_URL}/alerts`);

  const lines = alerts.map((a, i) => {
    const parts = [a.keyword && `<code>${a.keyword}</code>`, a.categoria, a.size].filter(Boolean);
    return `${i + 1}. ${parts.join(' · ')}`;
  });

  return reply(chatId,
    `🔔 <b>Seus alertas ativos (${alerts.length}):</b>\n\n${lines.join('\n')}\n\n` +
    `Gerenciar: ${SITE_URL}/alerts`
  );
}

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

// ── Endpoint ──────────────────────────────────────────────────────────────────

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

  const [cmd, ...args] = text.split(' ');
  const cmdBase        = cmd.split('@')[0]; // remove @bot_username se presente

  switch (cmdBase) {
    case '/start':   await handleStart(chatId, username, args[0] ?? ''); break;
    case '/status':  await handleStatus(chatId); break;
    case '/alertas': await handleMeusAlertas(chatId); break;
    case '/cancelar': {
      const kw = args.join(' ').trim();
      if (!kw) await reply(chatId, '❌ Informe a keyword. Ex: /cancelar hoodie');
      else      await handleCancelar(chatId, kw);
      break;
    }
    default:
      await reply(chatId,
        '❓ Comandos disponíveis:\n\n' +
        '/status — seu plano atual\n' +
        '/alertas — seus alertas ativos\n' +
        '/cancelar [keyword] — desativa um alerta\n\n' +
        `Acesse ${SITE_URL} para mais opções.`
      );
  }

  return NextResponse.json({ ok: true });
}
