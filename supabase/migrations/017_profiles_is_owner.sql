-- Campo para identificar o dono da plataforma e excluí-lo da contagem de marketing
ALTER TABLE public.dealspro_profiles
  ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;

-- Atualiza get_premium_count para não contar o dono
CREATE OR REPLACE FUNCTION public.get_premium_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM dealspro_profiles
  WHERE plan = 'premium'
    AND is_owner = false;
$$;

GRANT EXECUTE ON FUNCTION public.get_premium_count() TO anon, authenticated;
