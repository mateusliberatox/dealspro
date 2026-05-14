-- Tabela de pagamentos PIX para idempotência forte e auditoria.
-- Idempotência por PRIMARY KEY (payment_id) — INSERT com ON CONFLICT garante 1 grant por pagamento.
-- Reembolsos (Stripe e MP) marcam o registro como refunded e revogam premium.

create table if not exists public.pix_payments (
  payment_id      text primary key,                          -- ID do MP, único globalmente
  user_id         uuid not null references auth.users(id) on delete cascade,
  amount          numeric(10, 2) not null,
  status          text not null check (status in ('pending', 'approved', 'refunded', 'cancelled', 'expired')),
  granted_at      timestamptz,                               -- quando o premium foi concedido (null se ainda não)
  refunded_at     timestamptz,
  raw             jsonb,                                     -- snapshot do payload MP para debug
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.pix_payments enable row level security;

-- Próprio usuário pode ler seus pagamentos; service role faz tudo
create policy "pix own read"      on public.pix_payments for select using (auth.uid() = user_id);
create policy "pix service role"  on public.pix_payments for all    using (true);

create index if not exists idx_pix_payments_user        on public.pix_payments (user_id, created_at desc);
create index if not exists idx_pix_payments_status      on public.pix_payments (status);

-- Trigger para manter updated_at em sync
create or replace function public.set_pix_payments_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_pix_payments_updated_at on public.pix_payments;
create trigger trg_pix_payments_updated_at
  before update on public.pix_payments
  for each row execute procedure public.set_pix_payments_updated_at();
