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

  const { data: product } = await supabase
    .from('produtos_dealspro')
    .select('id, nome, nome_traduzido, preco, link, imagem, categoria')
    .eq('id', id)
    .single();

  if (!product) notFound();

  const { data: { user } } = await supabase.auth.getUser();
  await trackClick(product.id, user?.id ?? null);

  const p    = product as Produto;
  const nome = p.nome_traduzido || p.nome;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 py-8" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm space-y-5">

        {/* Card do produto */}
        <div className="overflow-hidden rounded-xl border" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {p.imagem ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imagem} alt={nome} referrerPolicy="no-referrer" className="w-full aspect-[4/3] object-cover" />
          ) : (
            <div className="flex aspect-[4/3] items-center justify-center" style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}>
              —
            </div>
          )}
          <div className="p-4 space-y-1">
            {p.categoria && (
              <p className="text-xs font-medium uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>{p.categoria}</p>
            )}
            <p className="text-sm font-semibold leading-snug line-clamp-2" style={{ color: 'var(--text)' }}>{nome}</p>
            <p className="text-xl font-bold" style={{ color: 'var(--accent-text)' }}>{p.preco || '—'}</p>
          </div>
        </div>

        <AdUnit slot="1621510108" format="rectangle" className="w-full" style={{ minHeight: 200 }} />

        <div className="text-center">
          <p className="mb-4 text-sm" style={{ color: 'var(--text-2)' }}>
            Você será redirecionado para o CSSDeals.
          </p>
          <RedirectCountdown href={p.link} seconds={5} />
        </div>

        <p className="text-center text-xs" style={{ color: 'var(--text-3)' }}>
          DealsPro não é afiliado ao cssdeals.com
        </p>
      </div>
    </div>
  );
}
