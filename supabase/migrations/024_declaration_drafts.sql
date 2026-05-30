-- Rascunhos de declaração aduaneira — usados pelo botão "Compartilhar" no Discord.
-- Auto-limpeza: drafts com mais de 24h são ignorados pelo bot.

create table if not exists public.declaration_drafts (
  id              uuid        primary key default gen_random_uuid(),
  discord_user_id text        not null,
  produto         text        not null,
  valor_usd       numeric     not null,
  quantidade      int         not null default 1,
  descricao       text        not null,  -- descrição sugerida pela IA
  categoria       text,
  avisos          text[],                -- lista de avisos
  created_at      timestamptz not null default now()
);

-- Sem RLS — acesso apenas via service_role (bot)
alter table public.declaration_drafts enable row level security;
create policy "declaration_drafts_service" on public.declaration_drafts
  for all to service_role using (true);

-- Índice para limpeza de drafts antigos
create index if not exists idx_declaration_drafts_created
  on public.declaration_drafts (created_at);
