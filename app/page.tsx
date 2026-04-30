import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { Feed } from '@/components/feed';
import type { Produto } from '@/lib/types';

export const revalidate = 60;

export default async function HomePage() {
  const supabase = await createClient();

  const { data: produtos } = await supabase
    .from('produtos_dealspro')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(100);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">
            Feed de Produtos
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Atualizado automaticamente a cada 5 minutos · {produtos?.length ?? 0} produtos no banco
          </p>
        </div>
        <Feed produtos={(produtos as Produto[]) ?? []} />
      </main>
    </div>
  );
}
