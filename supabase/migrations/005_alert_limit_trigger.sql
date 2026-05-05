-- Applied via Supabase MCP on 2026-05-05
-- Trigger: limita cada usuário a 10 alertas

CREATE OR REPLACE FUNCTION public.check_max_user_alerts()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM public.user_alerts_dealspro WHERE user_id = NEW.user_id) >= 10 THEN
    RAISE EXCEPTION 'Limite de 10 alertas por usuário atingido';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_max_user_alerts ON public.user_alerts_dealspro;
CREATE TRIGGER enforce_max_user_alerts
  BEFORE INSERT ON public.user_alerts_dealspro
  FOR EACH ROW EXECUTE FUNCTION public.check_max_user_alerts();
