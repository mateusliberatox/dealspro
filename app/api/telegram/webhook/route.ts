import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram';
import { NextRequest, NextResponse } from 'next/server';
import {
  handleStart,
  handleAssinar,
  handleStatus,
  handleAlertas,
  handleCancelar,
  handleFeed,
  handleModo,
  type TelegramCtx,
} from '@/lib/telegram-webhook-handlers';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function buildCtx(): TelegramCtx {
  return {
    db,
    reply: async (chatId, text) => { await sendTelegramMessage(chatId, text).catch(() => {}); },
  };
}

export async function POST(request: NextRequest) {
  const secret     = request.headers.get('x-telegram-bot-api-secret-token') ?? '';
  const configured = process.env.TELEGRAM_WEBHOOK_SECRET ?? '';
  if (!configured || secret !== configured) {
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

  const ctx = buildCtx();

  switch (cmdBase) {
    case '/start':    await handleStart(ctx, chatId, username, arg); break;
    case '/assinar':  await handleAssinar(ctx, chatId); break;
    case '/status':   await handleStatus(ctx, chatId); break;
    case '/alertas':  await handleAlertas(ctx, chatId); break;
    case '/cancelar':
      if (!arg) await ctx.reply(chatId, '❌ Informe a keyword. Ex: /cancelar hoodie');
      else      await handleCancelar(ctx, chatId, arg);
      break;
    case '/feed': await handleFeed(ctx, chatId); break;
    case '/modo': await handleModo(ctx, chatId, arg); break;
    default:
      await ctx.reply(chatId,
        '📋 <b>Comandos disponíveis:</b>\n\n' +
        '/assinar — assinar o Premium\n' +
        '/status — seu plano atual\n' +
        '/alertas — seus alertas ativos\n' +
        '/cancelar [keyword] — desativar alerta\n' +
        '/feed — ativar/desativar feed de deals\n' +
        '/modo — configurar modo de notificação',
      );
  }

  return NextResponse.json({ ok: true });
}
