-- Applied via Supabase MCP on 2026-04-30
-- sizes array, discord profile fields, user_alerts, notification_logs

alter table public.produtos_dealspro
  add column if not exists sizes text[] not null default '{}';

alter table public.dealspro_profiles
  add column if not exists discord_user_id text,
  add column if not exists discord_username text,
  add column if not exists discord_avatar   text;

create table if not exists public.user_alerts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  keyword    text not null,
  size       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.user_alerts enable row level security;
create policy "own alerts"            on public.user_alerts for all using (auth.uid() = user_id);
create policy "service role alerts"   on public.user_alerts for all using (true);

create table if not exists public.notification_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  product_id bigint references public.produtos_dealspro(id) on delete cascade,
  alert_id   uuid references public.user_alerts(id) on delete set null,
  channel    text not null default 'discord_dm',
  status     text not null default 'pending' check (status in ('pending','sent','failed')),
  error      text,
  created_at timestamptz not null default now()
);
alter table public.notification_logs enable row level security;
create policy "own logs"            on public.notification_logs for select using (auth.uid() = user_id);
create policy "service role logs"   on public.notification_logs for all using (true);
