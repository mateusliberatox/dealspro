-- Troca on delete cascade por on delete set null em notification_logs.product_id
-- para que o histórico de notificações não seja apagado quando um produto é removido,
-- preservando a deduplicação mesmo após o produto ser deletado e re-inserido.

alter table public.notification_logs
  drop constraint notification_logs_product_id_fkey;

alter table public.notification_logs
  add constraint notification_logs_product_id_fkey
  foreign key (product_id)
  references public.produtos_dealspro(id)
  on delete set null;
