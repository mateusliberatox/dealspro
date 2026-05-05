import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { Feed } from '@/components/feed';
import { AdUnit } from '@/components/ad-unit';
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

    let query = supabase
      .from('produtos_dealspro')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(200);

    if (!isPremium) query = query.lte('visible_at', now);

    const { data: produtos } = await query;

    let upcomingCount = 0;
    if (!isPremium) {
      const { count } = await supabase
        .from('produtos_dealspro')
        .select('*', { count: 'exact', head: true })
        .gt('visible_at', now);
      upcomingCount = count ?? 0;
    }

    return { produtos: (produtos as Produto[]) ?? [], isPremium, upcomingCount, isLoggedIn: !!user };
  } catch {
    return { produtos: [], isPremium: false, upcomingCount: 0, isLoggedIn: false };
  }
}

export default async function HomePage() {
  const { produtos, isPremium, upcomingCount, isLoggedIn } = await getPageData();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-8">

        {/* Hero — só para visitantes e usuários free */}
        {!isPremium && (
          <div className="mb-6 rounded-2xl border p-5 sm:p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--text)' }}>
                  Deals em tempo real do CSSDeals
                </h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
                  Monitoramos o site a cada 5 minutos. Premium vê os produtos 30 minutos antes.
                </p>
              </div>

              {/* FOMO CTA */}
              {upcomingCount > 0 && (
                <a
                  href={isLoggedIn ? '/upgrade' : '/login'}
                  className="flex shrink-0 items-center gap-3 rounded-xl border border-orange-500/40 bg-orange-500/10 px-4 py-3 transition-colors hover:bg-orange-500/20"
                >
                  <span className="text-2xl">🔒</span>
                  <div>
                    <p className="text-sm font-bold text-orange-400">
                      +{upcomingCount} produto{upcomingCount !== 1 ? 's' : ''} chegando
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                      {isLoggedIn ? 'Assine o Premium para ver agora' : 'Entre e assine para ver agora'}
                    </p>
                  </div>
                </a>
              )}

              {/* CTA para visitantes sem produtos em delay */}
              {upcomingCount === 0 && !isLoggedIn && (
                <a
                  href="/login"
                  className="shrink-0 rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
                >
                  Entrar grátis
                </a>
              )}
            </div>
          </div>
        )}

        {/* Premium hero */}
        {isPremium && (
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Feed de Deals</h1>
              <p className="mt-0.5 text-sm" style={{ color: 'var(--text-3)' }}>
                {produtos.length} produto{produtos.length !== 1 ? 's' : ''} · acesso em tempo real
                <span className="ml-1.5 inline-flex items-center rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
                  ⚡ Premium
                </span>
              </p>
            </div>
          </div>
        )}

        {/* AdSense — banner top */}
        <AdUnit
          slot="1621510108"
          format="horizontal"
          className="mb-6"
          style={{ minHeight: 90 }}
        />

        <Feed produtos={produtos} isPremium={isPremium} />
      </main>
    </div>
  );
}
