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
      <main className="mx-auto max-w-6xl px-4 pt-8 pb-16">

        {/* Cabeçalho da página */}
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            {isPremium ? (
              <>
                <h1 className="text-[1.375rem] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                  Feed de Deals
                </h1>
                <p className="mt-0.5 text-sm" style={{ color: 'var(--text-3)' }}>
                  {produtos.length} produto{produtos.length !== 1 ? 's' : ''} · tempo real
                  <span className="ml-2 text-orange-400 font-medium">⚡ Premium</span>
                </p>
              </>
            ) : (
              <>
                <h1 className="text-[1.375rem] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
                  Deals do CSSDeals
                </h1>
                <p className="mt-0.5 text-sm" style={{ color: 'var(--text-3)' }}>
                  Atualizado a cada 5 min · {produtos.length} disponíveis agora
                </p>
              </>
            )}
          </div>

          {/* FOMO — compacto e direto, sem box */}
          {!isPremium && upcomingCount > 0 && (
            <a
              href={isLoggedIn ? '/upgrade' : '/login'}
              className="shrink-0 flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors hover:bg-orange-500/20"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}
            >
              <span className="font-bold">+{upcomingCount}</span>
              <span className="hidden sm:inline" style={{ color: 'var(--text-3)' }}>chegando — ver agora</span>
              <span className="sm:hidden" style={{ color: 'var(--text-3)' }}>chegando</span>
            </a>
          )}
        </div>

        {/* AdSense */}
        <AdUnit slot="1621510108" format="horizontal" className="mb-6" style={{ minHeight: 90 }} />

        <Feed produtos={produtos} isPremium={isPremium} />
      </main>
    </div>
  );
}
