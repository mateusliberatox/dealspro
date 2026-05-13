-- Índices para queries de deduplicação por cssdeals_item_id
create index if not exists idx_notif_item_channel
  on public.notification_logs (cssdeals_item_id, channel)
  where cssdeals_item_id is not null;

create index if not exists idx_notif_user_item_channel
  on public.notification_logs (user_id, cssdeals_item_id, channel)
  where cssdeals_item_id is not null;
