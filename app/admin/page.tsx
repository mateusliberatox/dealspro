export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { CategorySelect } from '@/components/category-select';
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
          <p style={{ color: 'var(--text-3)' }}>Acesso restrito.</p>
        </main>
      </div>
    );
  }

  const now = new Date().toISOString();

  const [{ data: produtos, count }, { count: clickCount }, { count: upcomingCount }] =
    await Promise.all([
      supabase
        .from('produtos_dealspro')
        .select('*', { count: 'exact' })
        .order('criado_em', { ascending: false })
        .limit(200),
      supabase
        .from('click_logs')
        .select('*', { count: 'exact', head: true }),
      supabase
        .from('produtos_dealspro')
        .select('*', { count: 'exact', head: true })
        .gt('visible_at', now),
    ]);

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
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Painel Admin</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
            {count} produtos · clique na categoria para editar
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Total produtos" value={count ?? 0} />
          <StatCard label="Clicks totais" value={clickCount ?? 0} highlight />
          <StatCard label="Em delay (free)" value={upcomingCount ?? 0} />
          {Object.entries(byCategory ?? {}).map(([cat, qty]) => (
            <StatCard key={cat} label={cat} value={qty} />
          ))}
        </div>

        {/* Product table */}
        <div className="overflow-x-auto rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">Categoria</th>
                <th className="px-4 py-3">Tamanhos</th>
                <th className="px-4 py-3">Preço</th>
                <th className="px-4 py-3">Visível em</th>
                <th className="px-4 py-3">Coletado</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
              {(produtos as Produto[])?.map((p) => {
                const isPending = new Date(p.visible_at) > new Date();
                return (
                  <tr key={p.id} className="transition-colors" style={{ background: 'transparent' }}>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-4)' }}>{p.id}</td>
                    <td className="px-4 py-2.5 max-w-xs">
                      <a
                        href={`/go/${p.id}`}
                        className="line-clamp-1 hover:text-orange-400 transition-colors"
                        style={{ color: 'var(--text-2)' }}
                      >
                        {p.nome_traduzido || p.nome}
                      </a>
                    </td>
                    <td className="px-4 py-2.5">
                      <CategorySelect id={p.id} current={p.categoria} />
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-3)' }}>
                      {p.sizes?.length ? p.sizes.join(', ') : '—'}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-orange-400">{p.preco}</td>
                    <td className="px-4 py-2.5 text-xs">
                      {isPending ? (
                        <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-orange-400">
                          {new Date(p.visible_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-4)' }}>Visível</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-4)' }}>
                      {new Date(p.criado_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <p className={`text-2xl font-bold ${highlight ? 'text-orange-400' : ''}`} style={highlight ? {} : { color: 'var(--text)' }}>
        {value}
      </p>
      <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>{label}</p>
    </div>
  );
}
