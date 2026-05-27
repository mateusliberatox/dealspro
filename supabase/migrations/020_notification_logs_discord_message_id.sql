-- Armazena o message_id retornado pelo webhook do Discord ao enviar para o canal premium.
-- Permite editar o embed depois com a imagem QC quando ela estiver disponível.

ALTER TABLE public.notification_logs
  ADD COLUMN IF NOT EXISTS discord_message_id TEXT;

CREATE INDEX IF NOT EXISTS notification_logs_discord_message_id_idx
  ON public.notification_logs (discord_message_id)
  WHERE discord_message_id IS NOT NULL;
