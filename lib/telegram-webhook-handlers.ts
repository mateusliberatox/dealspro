import type { SupabaseClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/site';
import { stripe, STRIPE_PRICE_ID, STRIPE_FIRST_MONTH_COUPON } from '@/lib/stripe';

export type NotifyMode = 'alerts_only' | 'all_deals' | 'both';

export const MODE_LABELS: Record<NotifyMode, string> = {
  alerts_only: '🔔 Somente alertas configurados',
  all_deals:   '📦 Todos os deals (respeitando seu plano)',
  both:        '🔔📦 Alertas + todos os deals',
};

export interface TelegramCtx {
  db:    SupabaseClient;
  reply: (chatId: number, text: string) => Promise<void>;
}

// ── /start ────────────────────────────────────────────────────────────────────

export async function handleStart(
  ctx: TelegramCtx,
  chatId: number,
  username: string | undefined,
  payload: string,
): Promise<void> {
  if (payload) {
    const { data: profile } = await ctx.db
      .from('dealspro_profiles')
      .select('user_id, telegram_chat_id')
      .eq('referral_code', payload)
      .single();

    if (!profile) {
      return ctx.reply(chatId,
        `❌ Código inválido.\n\nAcesse <a href="${SITE_URL}/minha-conta">Minha Conta</a> e clique em "Vincular Telegram".`,
      );
    }
    if (profile.telegram_chat_id === chatId) {
      return ctx.reply(chatId, '✅ Sua conta já está vinculada ao DealsPro!');
    }

    await ctx.db
      .from('dealspro_profiles')
      .update({ telegram_chat_id: chatId, telegram_username: username ?? null })
      .eq('user_id', profile.user_id);

    return ctx.reply(chatId,
      '✅ <b>Conta DealsPro vinculada!</b>\n\n' +
      'Você pode receber alertas e deals por aqui.\n\n' +
      'Comandos disponíveis:\n' +
      '/status — seu plano\n' +
      '/alertas — seus alertas\n' +
      '/feed — ativar/desativar feed de deals\n' +
      '/modo — modo de notificação\n' +
      '/assinar — assinar o Premium\n' +
      '/cancelar [keyword] — desativar alerta',
    );
  }

  return ctx.reply(chatId,
    '👋 <b>Bem-vindo ao DealsPro!</b>\n\n' +
    `Para vincular sua conta acesse:\n<a href="${SITE_URL}/minha-conta">${SITE_URL}/minha-conta</a>\n\n` +
    'E clique em <b>Vincular Telegram</b>.',
  );
}

// ── /assinar ──────────────────────────────────────────────────────────────────

export async function handleAssinar(ctx: TelegramCtx, chatId: number): Promise<void> {
  const { data: profile } = await ctx.db
    .from('dealspro_profiles')
    .select('user_id, plan, stripe_customer_id')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) {
    return ctx.reply(chatId, `❌ Conta não encontrada.\n\nAcesse ${SITE_URL}/minha-conta e vincule seu Telegram.`);
  }
  if (profile.plan === 'premium') {
    return ctx.reply(chatId, '⭐ Você já é <b>Premium</b>! Aproveite os benefícios exclusivos.');
  }

  const coupon        = STRIPE_FIRST_MONTH_COUPON;
  const applyDiscount = coupon && !profile.stripe_customer_id;
  const session       = await stripe.checkout.sessions.create({
    line_items:          [{ price: STRIPE_PRICE_ID, quantity: 1 }],
    mode:                'subscription',
    client_reference_id: profile.user_id,
    customer:            profile.stripe_customer_id ?? undefined,
    success_url:         `${SITE_URL}/minha-conta`,
    cancel_url:          `${SITE_URL}/upgrade`,
    ...(applyDiscount ? { discounts: [{ coupon }] } : {}),
  });

  return ctx.reply(chatId,
    '🔗 <b>Seu link exclusivo para o DealsPro Premium:</b>\n\n' +
    `👉 <a href="${session.url}">Assinar agora</a>\n\n` +
    '<i>Somente você está vendo esta mensagem. Link válido por 24 horas.</i>',
  );
}

// ── /status ───────────────────────────────────────────────────────────────────

export async function handleStatus(ctx: TelegramCtx, chatId: number): Promise<void> {
  const { data: profile } = await ctx.db
    .from('dealspro_profiles')
    .select('plan, plan_expires_at, telegram_notify_mode')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) {
    return ctx.reply(chatId, `❌ Conta não encontrada.\n\nAcesse ${SITE_URL}/minha-conta e vincule seu Telegram.`);
  }

  const mode = MODE_LABELS[(profile.telegram_notify_mode as NotifyMode)] ?? MODE_LABELS.alerts_only;

  if (profile.plan === 'premium') {
    const expires = profile.plan_expires_at
      ? new Date(profile.plan_expires_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
      : null;
    return ctx.reply(chatId,
      `⭐ <b>Plano Premium</b> — ativo\n` +
      (expires ? `🗓 Renovação: ${expires}\n` : '') +
      `\n📬 Modo: ${mode}`,
    );
  }

  return ctx.reply(chatId,
    `📦 <b>Plano Gratuito</b>\n` +
    `📬 Modo: ${mode}\n\n` +
    `Use /assinar para obter o Premium.`,
  );
}

// ── /alertas ──────────────────────────────────────────────────────────────────

export async function handleAlertas(ctx: TelegramCtx, chatId: number): Promise<void> {
  const { data: profile } = await ctx.db
    .from('dealspro_profiles')
    .select('user_id, plan')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) return ctx.reply(chatId, `❌ Conta não encontrada. Acesse ${SITE_URL}/minha-conta`);
  if (profile.plan !== 'premium') {
    return ctx.reply(chatId, `📦 Alertas por keyword são exclusivos do Premium.\n\n/assinar para ativar.`);
  }

  const { data: alerts } = await ctx.db
    .from('user_alerts_dealspro')
    .select('keyword, categoria, size, is_active')
    .eq('user_id', profile.user_id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (!alerts?.length) {
    return ctx.reply(chatId, `🔔 Nenhum alerta ativo.\n\nCrie em ${SITE_URL}/alerts`);
  }

  const lines = (alerts as Array<{ keyword?: string; categoria?: string; size?: string }>).map((a, i) => {
    const parts = [a.keyword && `<code>${a.keyword}</code>`, a.categoria, a.size].filter(Boolean);
    return `${i + 1}. ${parts.join(' · ')}`;
  });

  return ctx.reply(chatId,
    `🔔 <b>Seus alertas ativos (${alerts.length}):</b>\n\n${lines.join('\n')}\n\n` +
    `Gerenciar: ${SITE_URL}/alerts`,
  );
}

// ── /cancelar ─────────────────────────────────────────────────────────────────

export async function handleCancelar(ctx: TelegramCtx, chatId: number, keyword: string): Promise<void> {
  const { data: profile } = await ctx.db
    .from('dealspro_profiles')
    .select('user_id')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) return ctx.reply(chatId, '❌ Conta não vinculada.');

  const { data: alert } = await ctx.db
    .from('user_alerts_dealspro')
    .select('id, keyword')
    .eq('user_id', profile.user_id)
    .ilike('keyword', keyword)
    .eq('is_active', true)
    .single();

  if (!alert) return ctx.reply(chatId, `❌ Nenhum alerta ativo com a keyword "${keyword}".`);

  await ctx.db.from('user_alerts_dealspro').update({ is_active: false }).eq('id', alert.id);
  return ctx.reply(chatId, `✅ Alerta "<b>${alert.keyword}</b>" desativado.`);
}

// ── /feed ─────────────────────────────────────────────────────────────────────

export async function handleFeed(ctx: TelegramCtx, chatId: number): Promise<void> {
  const { data: profile } = await ctx.db
    .from('dealspro_profiles')
    .select('user_id, plan, telegram_notify_mode')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) return ctx.reply(chatId, `❌ Conta não vinculada. Acesse ${SITE_URL}/minha-conta`);

  const current = (profile.telegram_notify_mode as NotifyMode) ?? 'alerts_only';
  let next: NotifyMode;
  if (current === 'alerts_only') {
    next = profile.plan === 'premium' ? 'both' : 'all_deals';
  } else {
    next = 'alerts_only';
  }

  await ctx.db
    .from('dealspro_profiles')
    .update({ telegram_notify_mode: next })
    .eq('user_id', profile.user_id);

  const feedAtivo = next !== 'alerts_only';
  return ctx.reply(chatId,
    feedAtivo
      ? `✅ <b>Feed de deals ativado!</b>\n\n${MODE_LABELS[next]}\n\n<i>Use /feed novamente para desativar.</i>`
      : `🔕 <b>Feed desativado.</b>\n\nVocê receberá apenas alertas configurados.\n\n<i>Use /feed para reativar.</i>`,
  );
}

// ── /modo ─────────────────────────────────────────────────────────────────────

export async function handleModo(ctx: TelegramCtx, chatId: number, arg: string): Promise<void> {
  const { data: profile } = await ctx.db
    .from('dealspro_profiles')
    .select('user_id, plan, telegram_notify_mode')
    .eq('telegram_chat_id', chatId)
    .single();

  if (!profile) return ctx.reply(chatId, `❌ Conta não vinculada.`);

  const validModes: NotifyMode[] = ['alerts_only', 'all_deals', 'both'];
  if (arg && validModes.includes(arg as NotifyMode)) {
    const next = arg as NotifyMode;
    await ctx.db
      .from('dealspro_profiles')
      .update({ telegram_notify_mode: next })
      .eq('user_id', profile.user_id);
    return ctx.reply(chatId, `✅ Modo atualizado para: ${MODE_LABELS[next]}`);
  }

  const current = (profile.telegram_notify_mode as NotifyMode) ?? 'alerts_only';
  return ctx.reply(chatId,
    `📬 <b>Modo atual:</b> ${MODE_LABELS[current]}\n\n` +
    `<b>Modos disponíveis:</b>\n` +
    `• /modo alerts_only — só alertas configurados\n` +
    `• /modo all_deals — todos os deals\n` +
    `• /modo both — alertas + todos os deals\n\n` +
    `Ou use /feed para ativar/desativar o feed rapidamente.`,
  );
}
