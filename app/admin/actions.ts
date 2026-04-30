'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const ALLOWED_CATEGORIES = [
  'Smartwatch', 'Bolsa / Mochila', 'Roupas', 'Eletrônicos', 'Calçados', 'Outros',
];

export async function updateCategoriaAction(id: number, categoria: string) {
  if (!ALLOWED_CATEGORIES.includes(categoria)) {
    throw new Error('Categoria inválida');
  }

  const supabase = await createClient();

  // Auth + admin check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Não autenticado');

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_admin) throw new Error('Acesso restrito');

  const { error } = await supabase
    .from('produtos_dealspro')
    .update({ categoria })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}
