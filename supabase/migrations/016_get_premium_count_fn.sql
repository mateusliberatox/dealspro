-- Função SECURITY DEFINER para contar usuários premium sem expor dados individuais.
-- Necessário porque dealspro_profiles tem RLS (só lê o próprio perfil),
-- então COUNT via client retornava sempre 1 para o usuário logado.
CREATE OR REPLACE FUNCTION public.get_premium_count()
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer FROM dealspro_profiles WHERE plan = 'premium';
$$;

GRANT EXECUTE ON FUNCTION public.get_premium_count() TO anon, authenticated;
