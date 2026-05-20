-- Índice para queries de deduplicação por product_id (fallback quando cssdeals_item_id é null)
create index if not exists idx_notif_user_product_channel
  on public.notification_logs (user_id, product_id, channel)
  where product_id is not null;
