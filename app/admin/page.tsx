import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import type { Produto } from '@/lib/types';

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('is_admin, plan')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_admin) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <p className="text-neutral-400">Acesso restrito.</p>
        </main>
      </div>
    );
  }

  const { data: produtos, count } = await supabase
    .from('produtos_dealspro')
    .select('*', { count: 'exact' })
    .order('criado_em', { ascending: false })
    .limit(200);

  const byCategory = (produtos as Produto[])?.reduce<Record<string, number>>((acc, p) => {
    const cat = p.categoria ?? 'Outros';
    acc[cat] = (acc[cat] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Painel Admin</h1>
          <p className="mt-1 text-sm text-neutral-500">Visão geral dos produtos coletados</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total de produtos" value={count ?? 0} />
          {Object.entries(byCategory ?? {}).map(([cat, qty]) => (
            <StatCard key={cat} label={cat} value={qty} />
          ))}
        </div>

        {/* Product table */}
        <div className="overflow-hidden rounded-xl border border-white/8 bg-[#141414]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 text-left text-xs text-neutral-500">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Coletado em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {(produtos as Produto[])?.map((p) => (
                <tr key={p.id} className="hover:bg-white/3 transition-colors">
                  <td className="px-4 py-2.5 text-neutral-500">{p.id}</td>
                  <td className="px-4 py-2.5 max-w-xs">
                    <a href={p.link} target="_blank" rel="noopener noreferrer"
                       className="line-clamp-1 text-neutral-200 hover:text-orange-400 transition-colors">
                      {p.nome_traduzido || p.nome}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-neutral-400">{p.categoria ?? '—'}</td>
                  <td className="px-4 py-2.5 font-medium text-orange-400">{p.preco}</td>
                  <td className="px-4 py-2.5 text-neutral-500 text-xs">
                    {new Date(p.criado_em).toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/8 bg-[#141414] p-4">
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="mt-1 text-xs text-neutral-500">{label}</p>
    </div>
  );
}
