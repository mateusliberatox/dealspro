-- Backfill cssdeals_item_id para produtos já existentes no banco
-- extrai o ?itemid= da URL para garantir deduplicação em produtos antigos
update public.produtos_dealspro
set cssdeals_item_id = (regexp_match(link, '[?&]itemid=(\d+)'))[1]::bigint
where cssdeals_item_id is null
  and link like '%itemid=%';
