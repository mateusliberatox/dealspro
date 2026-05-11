export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { Header } from '@/components/header';
import { CategorySelect } from '@/components/category-select';
import type { Produto } from '@/lib/types';

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_admin) redirect('/');

  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const now      = new Date();
  const day7ago  = new Date(Date.now() - 7  * 86_400_000).toISOString();
  const day30ago = new Date(Date.now() - 30 * 86_400_000).toISOString();

  const [
    { data: produtos, count: totalProdutos },
    { count: premiumCount },
    { count: freeCount },
    { count: clicksTotal },
    { count: clicks7d },
    { count: alertsTotal },
    { count: alertsSent7d },
    { count: upcomingCount },
    { count: esgotadosCount },
    { data: topCategories },
    { data: recentUsers },
  ] = await Promise.all([
    admin.from('produtos_dealspro').select('*', { count: 'exact' }).order('criado_em', { ascending: false }).limit(200),
    admin.from('dealspro_profiles').select('*', { count: 'exact', head: true }).eq('plan', 'premium'),
    admin.from('dealspro_profiles').select('*', { count: 'exact', head: true }).eq('plan', 'free'),
    admin.from('click_logs').select('*', { count: 'exact', head: true }),
    admin.from('click_logs').select('*', { count: 'exact', head: true }).gte('created_at', day7ago),
    admin.from('user_alerts_dealspro').select('*', { count: 'exact', head: true }).eq('is_active', true),
    admin.from('notification_logs').select('*', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', day7ago),
    admin.from('produtos_dealspro').select('*', { count: 'exact', head: true }).gt('visible_at', now.toISOString()),
    admin.from('produtos_dealspro').select('*', { count: 'exact', head: true }).eq('disponivel', false),
    admin.from('produtos_dealspro').select('categoria').gte('criado_em', day30ago),
    admin.from('dealspro_profiles').select('created_at, plan').order('created_at', { ascending: false }).limit(5),
  ]);

  // Agrupa categorias
  const catCount: Record<string, number> = {};
  (topCategories ?? []).forEach(({ categoria }) => {
    const c = categoria ?? 'Outros';
    catCount[c] = (catCount[c] ?? 0) + 1;
  });
  const sortedCats = Object.entries(catCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const revenue = (premiumCount ?? 0) * 7.99;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">

        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Painel Admin</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
            Visão geral do negócio · atualizado agora
          </p>
        </div>

        {/* Métricas principais */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Negócio</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Receita mensal est." value={`R$ ${revenue.toFixed(2).replace('.', ',')}`} highlight />
            <StatCard label="Usuários Premium" value={premiumCount ?? 0} />
            <StatCard label="Usuários Free" value={freeCount ?? 0} />
            <StatCard label="Total usuários" value={(premiumCount ?? 0) + (freeCount ?? 0)} />
          </div>
        </div>

        {/* Métricas de conteúdo */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Conteúdo</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Produtos no feed" value={totalProdutos ?? 0} />
            <StatCard label="Em delay (free)" value={upcomingCount ?? 0} />
            <StatCard label="Esgotados" value={esgotadosCount ?? 0} />
            <StatCard label="Alertas ativos" value={alertsTotal ?? 0} />
          </div>
        </div>

        {/* Métricas de engajamento */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Engajamento (7 dias)</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Cliques totais" value={clicksTotal ?? 0} />
            <StatCard label="Cliques 7 dias" value={clicks7d ?? 0} highlight />
            <StatCard label="DMs enviadas 7d" value={alertsSent7d ?? 0} />
          </div>
        </div>

        {/* Top categorias + Últimos usuários */}
        <div className="grid gap-4 sm:grid-cols-2">

          <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Top categorias (30 dias)</p>
            {sortedCats.map(([cat, qty]) => {
              const pct = Math.round((qty / (topCategories?.length ?? 1)) * 100);
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-2)' }}>
                    <span>{cat}</span>
                    <span>{qty} produtos · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                    <div className="h-full rounded-full gradient-blue-bright" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border p-5 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Últimos cadastros</p>
            {(recentUsers ?? []).map((u, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span style={{ color: 'var(--text-2)' }}>
                  {new Date(u.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
                <span
                  className="rounded px-2 py-0.5 font-semibold"
                  style={
                    u.plan === 'premium'
                      ? { background: 'var(--accent-dim)', color: 'var(--accent-text)' }
                      : { background: 'var(--surface-3)', color: 'var(--text-3)' }
                  }
                >
                  {u.plan}
                </span>
              </div>
            ))}
          </div>

        </div>

        {/* Tabela de produtos */}
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Produtos recentes</p>
          <div className="overflow-x-auto rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs" style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3">Tamanhos</th>
                  <th className="px-4 py-3">Preço</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Coletado</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {(produtos as Produto[])?.map((p) => {
                  const isPending  = new Date(p.visible_at) > new Date();
                  const esgotado   = p.disponivel === false;
                  return (
                    <tr key={p.id} className="transition-colors" style={{ opacity: esgotado ? 0.5 : 1 }}>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-4)' }}>{p.id}</td>
                      <td className="px-4 py-2.5 max-w-xs">
                        <a href={`/go/${p.id}`} className="line-clamp-1 hover:underline" style={{ color: 'var(--text-2)' }}>
                          {p.nome_traduzido || p.nome}
                        </a>
                      </td>
                      <td className="px-4 py-2.5"><CategorySelect id={p.id} current={p.categoria} /></td>
                      <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-3)' }}>
                        {p.sizes?.length ? p.sizes.join(', ') : '—'}
                      </td>
                      <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--accent-text)' }}>{p.preco}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {esgotado ? (
                          <span className="rounded px-1.5 py-0.5 text-red-400" style={{ background: 'rgba(239,68,68,0.1)' }}>Esgotado</span>
                        ) : isPending ? (
                          <span className="rounded px-1.5 py-0.5" style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}>
                            {new Date(p.visible_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        ) : (
                          <span className="text-green-500">Visível</span>
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
        </div>

      </main>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: number | string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border p-4 space-y-1" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
      <p className="text-2xl font-bold" style={{ color: highlight ? 'var(--accent-text)' : 'var(--text)' }}>
        {value}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-3)' }}>{label}</p>
    </div>
  );
}
