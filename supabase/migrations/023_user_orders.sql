-- Rastreamento de encomendas por usuário.
-- Integração com 17Track API (suporta +2000 transportadoras, incluindo Correios).

create table if not exists public.user_orders (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        not null references auth.users on delete cascade,
  tracking_code   text        not null,
  carrier_code    int         default 0,  -- 0 = auto-detect (17Track)
  description     text,                   -- descrição fornecida pelo usuário
  status          text        not null default 'pending'
                                check (status in (
                                  'pending', 'in_transit', 'customs',
                                  'out_for_delivery', 'delivered', 'failed', 'returned'
                                )),
  last_event      text,                   -- último evento do transportador
  last_event_at   timestamptz,
  last_checked_at timestamptz,            -- última vez que consultamos a API
  notified_status text,                   -- último status sobre o qual mandamos DM
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint user_orders_unique_code unique (user_id, tracking_code)
);

-- RLS: usuário vê/gerencia apenas suas próprias encomendas
alter table public.user_orders enable row level security;

create policy "user_orders_select" on public.user_orders for select using (auth.uid() = user_id);
create policy "user_orders_insert" on public.user_orders for insert with check (auth.uid() = user_id);
create policy "user_orders_update" on public.user_orders for update using (auth.uid() = user_id);
create policy "user_orders_delete" on public.user_orders for delete using (auth.uid() = user_id);
create policy "user_orders_service" on public.user_orders for all to service_role using (true);

-- Índice para o cron: busca encomendas ativas que não foram checadas recentemente
create index if not exists idx_user_orders_pending_check
  on public.user_orders (last_checked_at nulls first)
  where status not in ('delivered', 'failed', 'returned');

-- Índice para a página web: ordenado por data de criação do usuário
create index if not exists idx_user_orders_user
  on public.user_orders (user_id, created_at desc);
