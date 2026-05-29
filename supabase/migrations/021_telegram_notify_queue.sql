-- Fila de retry para DMs Telegram que falharam em alertService.
-- Espelha discord_role_sync: o cron processa pendentes até max_attempts.

create table if not exists public.telegram_notify_queue (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references auth.users on delete cascade,
  telegram_chat_id bigint not null,
  product_id       bigint,
  cssdeals_item_id bigint,
  alert_id         bigint,
  message_text     text not null,
  image_url        text,
  attempts         int  not null default 0,
  max_attempts     int  not null default 3,
  last_error       text,
  created_at       timestamptz not null default now(),
  next_retry_at    timestamptz not null default now()
);

alter table public.telegram_notify_queue enable row level security;
create policy "telegram_notify_queue service" on public.telegram_notify_queue for all using (true);

create index if not exists idx_telegram_notify_queue_pending
  on public.telegram_notify_queue (next_retry_at, attempts)
  where attempts < max_attempts;
