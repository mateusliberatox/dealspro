import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { Feed } from '@/components/feed';
import type { Produto } from '@/lib/types';

export const revalidate = 30;

async function getPageData() {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();

    const { data: { user } } = await supabase.auth.getUser();

    let plan: 'free' | 'premium' = 'free';
    if (user) {
      const { data: profile } = await supabase
        .from('dealspro_profiles')
        .select('plan')
        .eq('user_id', user.id)
        .single();
      plan = profile?.plan ?? 'free';
    }

    const isPremium = plan === 'premium';

    // Visible products
    let query = supabase
      .from('produtos_dealspro')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(200);

    if (!isPremium) query = query.lte('visible_at', now);

    const { data: produtos } = await query;

    // Count of upcoming products (for free FOMO CTA)
    let upcomingCount = 0;
    if (!isPremium) {
      const { count } = await supabase
        .from('produtos_dealspro')
        .select('*', { count: 'exact', head: true })
        .gt('visible_at', now);
      upcomingCount = count ?? 0;
    }

    return { produtos: (produtos as Produto[]) ?? [], isPremium, upcomingCount };
  } catch {
    return { produtos: [], isPremium: false, upcomingCount: 0 };
  }
}

export default async function HomePage() {
  const { produtos, isPremium, upcomingCount } = await getPageData();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Feed de Produtos</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
              Atualizado a cada 5 minutos · {produtos.length} produto{produtos.length !== 1 ? 's' : ''}
              {isPremium && ' · acesso premium em tempo real'}
            </p>
          </div>

          {/* FOMO CTA for free users */}
          {!isPremium && upcomingCount > 0 && (
            <a
              href="/login"
              className="flex items-center gap-2 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-2.5 text-sm transition-colors hover:bg-orange-500/20"
            >
              <span className="text-lg">🔒</span>
              <div className="text-left">
                <p className="font-semibold text-orange-400">
                  +{upcomingCount} produto{upcomingCount !== 1 ? 's' : ''} chegando
                </p>
                <p className="text-xs" style={{ color: 'var(--text-3)' }}>Premium vê agora</p>
              </div>
            </a>
          )}
        </div>

        {/* Ad banner slot — replace with AdSense or other network */}
        <div
          id="ad-banner-top"
          className="mb-6 flex h-16 items-center justify-center rounded-xl border text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-4)', background: 'var(--surface)' }}
        >
          {/* INSERT AD CODE HERE */}
          Publicidade
        </div>

        <Feed produtos={produtos} isPremium={isPremium} />
      </main>
    </div>
  );
}
