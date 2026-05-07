export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RedirectCountdown } from '@/components/redirect-countdown';
import { AdUnit } from '@/components/ad-unit';
import type { Produto } from '@/lib/types';

async function trackClick(productId: number, userId: string | null) {
  try {
    const supabase = await createClient();
    await supabase.from('click_logs').insert({ product_id: productId, user_id: userId });
  } catch {}
}

export default async function GoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const now = new Date().toISOString();

  // Produto principal
  const { data: product } = await supabase
    .from('produtos_dealspro')
    .select('id, nome, nome_traduzido, preco, link, imagem, categoria')
    .eq('id', id)
    .single();

  if (!product) notFound();

  const p    = product as Produto;
  const nome = p.nome_traduzido || p.nome;

  // Usuário e plano
  const { data: { user } } = await supabase.auth.getUser();
  await trackClick(p.id, user?.id ?? null);

  let isPremium = false;
  if (user) {
    const { data: profile } = await supabase
      .from('dealspro_profiles')
      .select('plan')
      .eq('user_id', user.id)
      .single();
    isPremium = profile?.plan === 'premium';
  }

  // Deals similares (mesma categoria, já visíveis)
  const { data: similar } = await supabase
    .from('produtos_dealspro')
    .select('id, nome, nome_traduzido, preco, imagem')
    .eq('categoria', p.categoria ?? 'Outros')
    .neq('id', p.id)
    .lte('visible_at', now)
    .order('criado_em', { ascending: false })
    .limit(4);

  // Contagem de deals em delay (FOMO para free)
  let upcomingCount = 0;
  if (!isPremium) {
    const { count } = await supabase
      .from('produtos_dealspro')
      .select('*', { count: 'exact', head: true })
      .gt('visible_at', now);
    upcomingCount = count ?? 0;
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-md px-4 pt-8 pb-16 space-y-6">

        {/* Produto — linha compacta */}
        <div
          className="flex items-center gap-3 rounded-xl border p-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {p.imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.imagem}
              alt={nome}
              referrerPolicy="no-referrer"
              className="h-16 w-16 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="h-16 w-16 shrink-0 rounded-lg" style={{ background: 'var(--surface-3)' }} />
          )}
          <div className="min-w-0">
            {p.categoria && (
              <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                {p.categoria}
              </p>
            )}
            <p className="text-sm font-medium leading-snug line-clamp-2" style={{ color: 'var(--text)' }}>
              {nome}
            </p>
            <p className="mt-0.5 text-base font-bold" style={{ color: 'var(--accent-text)' }}>
              {p.preco || '—'}
            </p>
          </div>
        </div>

        {/* Countdown — ação principal, bem destacada */}
        <div
          className="rounded-xl border p-6 text-center space-y-4"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
            Abrindo no CSSDeals…
          </p>
          <RedirectCountdown href={p.link} seconds={5} />
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            DealsPro não é afiliado ao cssdeals.com
          </p>
        </div>

        {/* AdSense — horizontal, mais confiável que retângulo */}
        <AdUnit slot="1621510108" format="horizontal" style={{ minHeight: 70 }} />

        {/* Outros deals da mesma categoria */}
        {similar && similar.length > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
              {p.categoria ? `Mais de ${p.categoria}` : 'Outros deals'}
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {similar.map((s) => {
                const sNome = (s as Produto).nome_traduzido || s.nome;
                return (
                  <a
                    key={s.id}
                    href={`/go/${s.id}`}
                    className="group flex flex-col overflow-hidden rounded-xl"
                    style={{ background: 'var(--surface)' }}
                  >
                    <div className="aspect-square w-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
                      {s.imagem ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.imagem}
                          alt={sNome}
                          referrerPolicy="no-referrer"
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center" style={{ color: 'var(--text-3)' }}>·</div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-bold" style={{ color: 'var(--accent-text)' }}>
                        {(s as Produto).preco || '—'}
                      </p>
                      <p className="text-[10px] leading-snug line-clamp-2 mt-0.5" style={{ color: 'var(--text-2)' }}>
                        {sNome}
                      </p>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Ad após deals similares — usuário que chegou até aqui tem alta intenção */}
        {similar && similar.length > 0 && (
          <AdUnit slot="1621510108" format="rectangle" style={{ minHeight: 250 }} />
        )}

        {/* FOMO — apenas para free, apenas se houver produtos em delay */}
        {!isPremium && upcomingCount > 0 && (
          <a
            href={user ? '/upgrade' : '/login'}
            className="flex items-center justify-between rounded-xl border p-4 transition-colors"
            style={{
              background: 'var(--accent-dim)',
              borderColor: 'rgba(3,40,144,0.20)',
            }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                +{upcomingCount} deal{upcomingCount !== 1 ? 's' : ''} chegando agora
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-2)' }}>
                Premium vê 30 min antes. {user ? 'Assinar →' : 'Criar conta →'}
              </p>
            </div>
            <span className="shrink-0 text-lg" style={{ color: 'var(--accent-text)' }}>→</span>
          </a>
        )}

      </div>
    </div>
  );
}
