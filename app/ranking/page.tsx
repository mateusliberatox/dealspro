import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { Header } from '@/components/header';
import { createClient } from '@/lib/supabase/server';
import { PRODUTO_COLS, type Produto } from '@/lib/types';

export const revalidate = 3600; // atualiza a cada hora

export const metadata: Metadata = {
  title: 'Ranking Semanal',
  description: 'Os deals do CSSDeals mais acessados da semana no DealsPro.',
};

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function isPlaceholder(url: string) {
  return /placeholder|800.?x.?900|skin\/img\/product\/\d+/i.test(url) || url.startsWith('data:');
}

export default async function RankingPage() {
  const supabase = await createClient();
  const weekAgo  = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Busca clicks da última semana
  const { data: clicks } = await supabase
    .from('click_logs')
    .select('product_id')
    .gte('created_at', weekAgo)
    .limit(5000);

  // Agrega em JS — conta clicks por produto
  const countMap = new Map<number, number>();
  for (const { product_id } of (clicks ?? [])) {
    if (product_id) countMap.set(product_id, (countMap.get(product_id) ?? 0) + 1);
  }

  // Ordena e pega top 20
  const topIds = [...countMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([id]) => id);

  let produtos: (Produto & { clicks: number })[] = [];

  if (topIds.length > 0) {
    const { data } = await supabase
      .from('produtos_dealspro')
      .select(PRODUTO_COLS)
      .in('id', topIds)
      .eq('disponivel', true);

    if (data) {
      produtos = (data as Produto[])
        .map((p) => ({ ...p, clicks: countMap.get(p.id) ?? 0 }))
        .sort((a, b) => b.clicks - a.clicks);
    }
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-10 space-y-6">

        {/* Header */}
        <div className="space-y-1 animate-fade-in-up">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            🔥 Ranking Semanal
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Os deals mais acessados nos últimos 7 dias
          </p>
        </div>

        {/* Lista */}
        {produtos.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              Ainda sem dados suficientes para o ranking desta semana.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {produtos.map((produto, i) => {
              const rank  = i + 1;
              const nome  = produto.nome_traduzido || produto.nome;
              const medal = MEDAL[rank];
              const hasImg = produto.imagem && !isPlaceholder(produto.imagem);

              return (
                <Link
                  key={produto.id}
                  href={`/go/${produto.id}`}
                  className="group flex items-center gap-4 rounded-xl border px-4 py-3 transition-all animate-fade-in-up hover:border-[var(--border-strong)]"
                  style={{
                    background:       'var(--surface)',
                    borderColor:      'var(--border)',
                    animationDelay:   `${i * 0.04}s`,
                  }}
                >
                  {/* Posição */}
                  <div className="w-8 shrink-0 text-center">
                    {medal ? (
                      <span className="text-xl">{medal}</span>
                    ) : (
                      <span className="text-sm font-bold" style={{ color: 'var(--text-3)' }}>
                        {rank}
                      </span>
                    )}
                  </div>

                  {/* Imagem */}
                  <div
                    className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg"
                    style={{ background: 'var(--surface-3)' }}
                  >
                    {hasImg ? (
                      <Image
                        src={produto.imagem}
                        alt={nome}
                        fill
                        sizes="48px"
                        referrerPolicy="no-referrer"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg">
                        📦
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    {produto.categoria && (
                      <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
                        {produto.categoria}
                      </p>
                    )}
                    <p
                      className="truncate text-sm font-medium group-hover:text-[var(--accent-text)] transition-colors"
                      style={{ color: 'var(--text)' }}
                    >
                      {nome}
                    </p>
                    <p className="text-sm font-bold" style={{ color: 'var(--accent-text)' }}>
                      {produto.preco || '—'}
                    </p>
                  </div>

                  {/* Clicks */}
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold" style={{ color: 'var(--text)' }}>
                      {produto.clicks}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--text-4)' }}>
                      acessos
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div
          className="rounded-xl border p-4 text-center animate-fade-in-up"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', animationDelay: '0.8s' }}
        >
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Ranking atualizado a cada hora · baseado em acessos reais
          </p>
          <Link
            href="/"
            className="mt-2 inline-flex rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            Ver todos os deals →
          </Link>
        </div>

      </main>
    </div>
  );
}
