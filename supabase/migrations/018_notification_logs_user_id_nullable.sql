-- notification_logs.user_id pode ser NULL para logs de canais (discord_premium,
-- discord_free) que não pertencem a um usuário específico.
ALTER TABLE notification_logs ALTER COLUMN user_id DROP NOT NULL;
