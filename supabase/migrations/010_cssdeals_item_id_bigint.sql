-- IDs do CSSDeals são snowflakes de 18 dígitos — integer não comporta, precisa de bigint
alter table public.produtos_dealspro
  alter column cssdeals_item_id type bigint;

alter table public.notification_logs
  alter column cssdeals_item_id type bigint;
