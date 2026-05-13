-- Identificador estável do item no CSSDeals (extraído do ?itemid= da URL)
-- Usado para deduplicação em notification_logs mesmo após deleção e reinserção do produto.
-- bigint: IDs do CSSDeals são snowflakes de 18 dígitos, fora do range de integer
alter table public.produtos_dealspro
  add column if not exists cssdeals_item_id bigint;

alter table public.notification_logs
  add column if not exists cssdeals_item_id bigint;
