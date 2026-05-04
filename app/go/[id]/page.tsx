export const dynamic = 'force-dynamic';

import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { RedirectCountdown } from '@/components/redirect-countdown';
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

  const nome = (product as Produto).nome_traduzido || (product as Produto).nome;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-lg space-y-6 text-center">
        {/* Product info */}
        <div>
          <p className="text-sm font-medium text-orange-500">Redirecionando para o produto</p>
          <h1 className="mt-2 text-xl font-bold" style={{ color: 'var(--text)' }}>{nome}</h1>
          <p className="mt-1 text-2xl font-bold text-orange-400">{(product as Produto).preco}</p>
        </div>

        {/* Ad zone — replace with real ad code */}
        <div
          id="ad-redirect"
          className="flex h-32 w-full items-center justify-center rounded-xl border text-xs"
          style={{ borderColor: 'var(--border)', color: 'var(--text-4)', background: 'var(--surface)' }}
        >
          {/* INSERT AD CODE HERE — e.g. Google AdSense 336x280 */}
          Publicidade
        </div>

        <RedirectCountdown href={(product as Produto).link} seconds={5} />

        <p className="text-xs" style={{ color: 'var(--text-4)' }}>
          DealsPro não é afiliado ao cssdeals.com
        </p>
      </div>
    </div>
  );
}
