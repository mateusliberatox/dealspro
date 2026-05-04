-- Applied via Supabase MCP on 2026-05-04
-- 30-minute delay system + click tracking

alter table public.produtos_dealspro
  add column if not exists visible_at    timestamptz not null default now() + interval '30 minutes',
  add column if not exists free_notified boolean     not null default false;

-- Existing products visible immediately
update public.produtos_dealspro set visible_at = criado_em where visible_at > now();

create index if not exists produtos_visible_at_idx on public.produtos_dealspro (visible_at);

create table if not exists public.click_logs (
  id         bigint generated always as identity primary key,
  product_id bigint references public.produtos_dealspro(id) on delete cascade,
  user_id    uuid   references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.click_logs enable row level security;
create policy "click_logs_service" on public.click_logs for all using (true);
