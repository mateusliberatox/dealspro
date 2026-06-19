-- Índices para queries quentes do monitor que não têm cobertura adequada

-- fetchHashMap + syncAvailability: WHERE criado_em >= cutoff (sem filtro disponivel)
-- O idx_produtos_disponivel_criado_em é parcial (WHERE disponivel = true) — não cobre estas queries.
create index if not exists idx_produtos_criado_em
  on public.produtos_dealspro (criado_em desc);

-- deleteOldProducts: DELETE WHERE criado_em < cutoff AND disponivel = false
-- Sem índice: força seq scan em cada housekeeping. O índice parcial WHERE disponivel = true
-- não cobre o caso disponivel = false.
create index if not exists idx_produtos_unavailable_criado_em
  on public.produtos_dealspro (criado_em)
  where disponivel = false;

-- deleteOldProducts: DELETE FROM notification_logs WHERE created_at < cutoff AND channel IN (...)
-- O idx_notif_user_created requer user_id como prefixo — não é usado nestas queries.
create index if not exists idx_notif_channel_created
  on public.notification_logs (channel, created_at);

-- deleteOldProducts: DELETE FROM translation_cache WHERE criado_em < cutoff
create index if not exists idx_translation_cache_criado_em
  on public.translation_cache (criado_em);
