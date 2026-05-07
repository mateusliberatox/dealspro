-- Adiciona filtro por categoria nos alertas do usuário
alter table public.user_alerts_dealspro
  add column if not exists categoria text;
