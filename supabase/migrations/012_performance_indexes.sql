-- Índices para queries quentes — feed, alerts, histórico, webhook.
-- Idempotente: usa `if not exists` em tudo e `DO` para colunas que podem não existir.

-- ── produtos_dealspro ──────────────────────────────────────────────────────────
-- Feed (app/page.tsx): WHERE disponivel=true [AND visible_at<=now] ORDER BY criado_em DESC LIMIT 200
-- visible_at já indexado em migration 004
create index if not exists idx_produtos_disponivel_criado_em
  on public.produtos_dealspro (disponivel, criado_em desc)
  where disponivel = true;

-- Admin (app/admin/page.tsx): filtros por categoria + criado_em
create index if not exists idx_produtos_categoria_criado_em
  on public.produtos_dealspro (categoria, criado_em desc)
  where categoria is not null;

-- ── user_alerts_dealspro ───────────────────────────────────────────────────────
-- Alerts UI + matching de notificações: WHERE user_id=? AND is_active=true
create index if not exists idx_user_alerts_user_active
  on public.user_alerts_dealspro (user_id, is_active);

-- ── notification_logs ──────────────────────────────────────────────────────────
-- Histórico por usuário em /minha-conta
create index if not exists idx_notif_user_created
  on public.notification_logs (user_id, created_at desc);

-- ── click_logs ─────────────────────────────────────────────────────────────────
-- Click count por produto (analytics)
create index if not exists idx_clicks_product
  on public.click_logs (product_id)
  where product_id is not null;

-- ── dealspro_profiles ──────────────────────────────────────────────────────────
-- Colunas adicionadas via MCP em migrations não-versionadas — wrap em DO block defensivo.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='dealspro_profiles' and column_name='stripe_customer_id'
  ) then
    create index if not exists idx_profiles_stripe_customer
      on public.dealspro_profiles (stripe_customer_id)
      where stripe_customer_id is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='dealspro_profiles' and column_name='discord_user_id'
  ) then
    create index if not exists idx_profiles_discord_user
      on public.dealspro_profiles (discord_user_id)
      where discord_user_id is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='dealspro_profiles' and column_name='telegram_chat_id'
  ) then
    create index if not exists idx_profiles_telegram_chat
      on public.dealspro_profiles (telegram_chat_id)
      where telegram_chat_id is not null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='dealspro_profiles' and column_name='referral_code'
  ) then
    create unique index if not exists idx_profiles_referral_code
      on public.dealspro_profiles (referral_code)
      where referral_code is not null;
  end if;

  -- Expiração de plano (cron + auto-expira em page.tsx)
  -- WHERE plan='premium' AND stripe_subscription_id IS NULL AND plan_expires_at < now()
  if exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='dealspro_profiles' and column_name='plan_expires_at'
  ) then
    create index if not exists idx_profiles_plan_expires
      on public.dealspro_profiles (plan_expires_at)
      where plan = 'premium' and plan_expires_at is not null;
  end if;
end $$;
