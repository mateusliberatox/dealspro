-- Identificador estável do item no CSSDeals (extraído do ?itemid= da URL)
-- Usado para deduplicação em notification_logs mesmo após deleção e reinserção do produto.
alter table public.produtos_dealspro
  add column if not exists cssdeals_item_id integer;

alter table public.notification_logs
  add column if not exists cssdeals_item_id integer;
