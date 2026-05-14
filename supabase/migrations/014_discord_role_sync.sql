-- Fila de retry para operações idempotentes no Discord (adicionar/remover cargo).
-- Hoje addPremiumRole/removePremiumRole fazem .catch(()=>{}) — falha silenciosa.
-- Esta tabela enfileira a operação; o cron tenta de novo até max_attempts.

create table if not exists public.discord_role_sync (
  id              uuid primary key default gen_random_uuid(),
  discord_user_id text not null,
  action          text not null check (action in ('add', 'remove')),
  status          text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  attempts        int  not null default 0,
  max_attempts    int  not null default 5,
  last_error      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.discord_role_sync enable row level security;
create policy "discord_role_sync service" on public.discord_role_sync for all using (true);

create index if not exists idx_discord_role_sync_pending
  on public.discord_role_sync (status, attempts, created_at)
  where status = 'pending';

create or replace function public.set_discord_role_sync_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_discord_role_sync_updated_at on public.discord_role_sync;
create trigger trg_discord_role_sync_updated_at
  before update on public.discord_role_sync
  for each row execute procedure public.set_discord_role_sync_updated_at();
