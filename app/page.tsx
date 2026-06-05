import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { Hero } from '@/components/hero';
import { Feed } from '@/components/feed';
import { AdUnit } from '@/components/ad-unit';
import { PRODUTO_COLS, type Produto } from '@/lib/types';
import { effectivePlan } from '@/lib/plan';

export const revalidate = 30;

async function getPageData() {
  try {
    const supabase = await createClient();
    const now      = new Date().toISOString();

    const { data: { user } } = await supabase.auth.getUser();

    let plan: 'free' | 'premium' = 'free';
    if (user) {
      const { data: profile } = await supabase
        .from('dealspro_profiles')
        .select('plan, plan_expires_at, stripe_subscription_id')
        .eq('user_id', user.id)
        .single();

      plan = effectivePlan(profile);
    }

    const isPremium = plan === 'premium';

    // PRODUTO_COLS (de lib/types.ts) economiza IO ao não ler hash, last_seen_at,
    // free_notified etc. Em revalidate=30s isso reduz transferência em ~3x.
    const [productsRes, totalRes, upcomingRes, premiumRes] = await Promise.all([
      (() => {
        let q = supabase
          .from('produtos_dealspro')
          .select(PRODUTO_COLS)
          .eq('disponivel', true)
          .order('criado_em', { ascending: false })
          .limit(200);
        if (!isPremium) q = q.lte('visible_at', now);
        return q;
      })(),
      // count: 'estimated' usa pg_class.reltuples (estatísticas) — instantâneo.
      // Total de deals é número de marketing no hero, não precisa ser exato.
      supabase
        .from('produtos_dealspro')
        .select('*', { count: 'estimated', head: true }),
      !isPremium
        ? supabase
            .from('produtos_dealspro')
            .select('*', { count: 'exact', head: true })
            .gt('visible_at', now)
        : Promise.resolve({ count: 0 }),
      supabase.rpc('get_premium_count'),
    ]);

    return {
      produtos:      (productsRes.data as Produto[]) ?? [],
      isPremium,
      upcomingCount: upcomingRes.count ?? 0,
      isLoggedIn:    !!user,
      totalDeals:    totalRes.count ?? 0,
      premiumCount:  (premiumRes.data as number) ?? 0,
    };
  } catch {
    return { produtos: [], isPremium: false, upcomingCount: 0, isLoggedIn: false, totalDeals: 0, premiumCount: 0 };
  }
}

export default async function HomePage() {
  const { produtos, isPremium, upcomingCount, isLoggedIn, totalDeals, premiumCount } = await getPageData();

  return (
    <div className="min-h-screen">
      <Header />

      <Hero
        totalDeals={totalDeals}
        premiumCount={premiumCount}
        isLoggedIn={isLoggedIn}
        isPremium={isPremium}
      />

      <main className="mx-auto max-w-screen-2xl px-4 pb-16">

        {/* Section header */}
        <div className="mb-6 flex items-end justify-between gap-4 animate-fade-in-up" style={{ animationDelay: '0.05s' }}>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
              {isPremium ? 'Feed em tempo real' : 'Feed de Deals'}
            </h2>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-2)' }}>
              {isPremium
                ? `${produtos.length} produto${produtos.length !== 1 ? 's' : ''} · atualizado agora`
                : `${produtos.length} disponíveis · atualizado a cada 2 min`}
              {isPremium && (
                <span className="ml-2 text-xs font-semibold" style={{ color: 'var(--accent-text)' }}>
                  ★ Premium
                </span>
              )}
            </p>
          </div>

          {!isPremium && upcomingCount > 0 && (
            <a
              href={isLoggedIn ? '/upgrade' : '/login'}
              className="glass-btn ripple shine-effect shrink-0 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
              style={{ color: 'var(--accent-text)' }}
            >
              <span className="font-bold">+{upcomingCount}</span>
              <span className="hidden sm:inline" style={{ color: 'var(--text-3)' }}>
                chegando — ver agora
              </span>
            </a>
          )}
        </div>

        <AdUnit slot="1621510108" format="horizontal" className="mb-7" style={{ minHeight: 90 }} />

        <Feed produtos={produtos} isPremium={isPremium} />
      </main>
    </div>
  );
}
