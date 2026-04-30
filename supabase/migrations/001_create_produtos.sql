create table if not exists public.produtos (
  id         bigint generated always as identity primary key,
  nome       text        not null,
  preco      text        not null default '',
  link       text        not null,
  imagem     text        not null default '',
  hash       text        not null unique,
  categoria  text,
  criado_em  timestamptz not null default now()
);

-- Fast lookup by hash (deduplication check on every cycle)
create index if not exists produtos_hash_idx on public.produtos (hash);

-- Fast lookup by insertion time (notifications & feeds)
create index if not exists produtos_criado_em_idx on public.produtos (criado_em desc);

-- Disable row-level security for service role (backend only)
alter table public.produtos enable row level security;

create policy "service_role_all" on public.produtos
  for all
  using (true)
  with check (true);
