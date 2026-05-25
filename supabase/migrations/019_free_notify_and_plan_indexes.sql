-- Índices para queries quentes sem cobertura adequada

-- ── produtos_dealspro: notificações free ────────────────────────────────────
-- sendFreeDelayedNotifications: WHERE free_notified=false AND disponivel=true AND visible_at<=now
-- Índice parcial — só indexa linhas pendentes de notificação (encolhe conforme são marcadas)
create index if not exists idx_produtos_free_notify
  on public.produtos_dealspro (visible_at, criado_em)
  where free_notified = false and disponivel = true;

-- ── dealspro_profiles: busca de usuários premium ────────────────────────────
-- notifyTelegramPremiumFeed + notifyTelegramFreeFeed: WHERE plan='premium'/'free'
-- Índice parcial — só cobre premium (maioria das queries de notificação)
create index if not exists idx_profiles_plan_premium
  on public.dealspro_profiles (plan)
  where plan = 'premium';
