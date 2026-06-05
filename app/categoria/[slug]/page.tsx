import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Header } from '@/components/header';
import { ProductCard } from '@/components/product-card';
import { createClient } from '@/lib/supabase/server';
import { PRODUTO_COLS, type Produto } from '@/lib/types';
import { AdUnit } from '@/components/ad-unit';

export const revalidate = 60;

// Mapa slug → categoria real no banco
const SLUG_MAP: Record<string, { categoria: string; label: string; emoji: string; desc: string }> = {
  roupas: {
    categoria: 'Roupas',
    label:     'Roupas',
    emoji:     '👕',
    desc:      'Camisetas, moletons, calças, jaquetas e mais — deals de roupas do CSSDeals em tempo real.',
  },
  calcados: {
    categoria: 'Calçados',
    label:     'Calçados',
    emoji:     '👟',
    desc:      'Tênis, sapatênis, botas e mais — deals de calçados do CSSDeals em tempo real.',
  },
  bolsas: {
    categoria: 'Bolsa / Mochila',
    label:     'Bolsas & Mochilas',
    emoji:     '🎒',
    desc:      'Bolsas, mochilas e acessórios de moda — deals do CSSDeals em tempo real.',
  },
  acessorios: {
    categoria: 'Acessórios',
    label:     'Acessórios',
    emoji:     '💍',
    desc:      'Cintos, óculos, bonés, meias e mais — deals de acessórios do CSSDeals em tempo real.',
  },
  smartwatch: {
    categoria: 'Smartwatch',
    label:     'Smartwatches',
    emoji:     '⌚',
    desc:      'Smartwatches e relógios inteligentes — deals do CSSDeals em tempo real.',
  },
  eletronicos: {
    categoria: 'Eletrônicos',
    label:     'Eletrônicos',
    emoji:     '📱',
    desc:      'Fones, gadgets, eletrônicos e acessórios tech — deals do CSSDeals em tempo real.',
  },
  outros: {
    categoria: 'Outros',
    label:     'Outros',
    emoji:     '📦',
    desc:      'Outros produtos e categorias variadas — deals do CSSDeals em tempo real.',
  },
};

export async function generateStaticParams() {
  return Object.keys(SLUG_MAP).map((slug) => ({ slug }));
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params;
  const entry = SLUG_MAP[slug];
  if (!entry) return { title: 'Categoria não encontrada' };

  return {
    title:       `${entry.emoji} Deals de ${entry.label} — CSSDeals`,
    description: entry.desc,
    openGraph: {
      title:       `Deals de ${entry.label} no CSSDeals`,
      description: entry.desc,
    },
  };
}

export default async function CategoriaPage(
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const entry = SLUG_MAP[slug];
  if (!entry) notFound();

  const supabase = await createClient();
  const now      = new Date().toISOString();

  const { data } = await supabase
    .from('produtos_dealspro')
    .select(PRODUTO_COLS)
    .eq('categoria', entry.categoria)
    .eq('disponivel', true)
    .lte('visible_at', now)
    .order('criado_em', { ascending: false })
    .limit(120);

  const produtos = (data ?? []) as Produto[];

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">

        {/* Header da categoria */}
        <div className="mb-6 space-y-1 animate-fade-in-up">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{entry.emoji}</span>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
                Deals de {entry.label}
              </h1>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>
                {produtos.length} produto{produtos.length !== 1 ? 's' : ''} disponíveis · atualizado a cada minuto
              </p>
            </div>
          </div>

          {/* Links para outras categorias */}
          <div className="flex flex-wrap gap-2 pt-3">
            {Object.entries(SLUG_MAP)
              .filter(([s]) => s !== slug)
              .map(([s, e]) => (
                <a
                  key={s}
                  href={`/categoria/${s}`}
                  className="rounded-full px-3 py-1 text-xs font-medium transition-colors hover:opacity-80"
                  style={{
                    background:  'var(--surface-2)',
                    border:      '1px solid var(--border)',
                    color:       'var(--text-2)',
                  }}
                >
                  {e.emoji} {e.label}
                </a>
              ))}
          </div>
        </div>

        <AdUnit slot="1621510108" format="horizontal" className="mb-7" style={{ minHeight: 90 }} />

        {/* Grid de produtos */}
        {produtos.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              Nenhum produto disponível agora nesta categoria. Novos deals chegam a cada minuto.
            </p>
            <a
              href="/"
              className="mt-4 inline-flex rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)' }}
            >
              Ver todos os deals
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {produtos.map((produto, i) => (
              <ProductCard key={produto.id} produto={produto} index={i} />
            ))}
          </div>
        )}

        {/* CTA premium */}
        <div
          className="mt-10 rounded-xl border p-5 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Quer ver os deals de {entry.label} antes de todo mundo?
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-2)' }}>
            Membros Premium recebem os deals 30 minutos antes e ainda têm alertas por DM no Discord.
          </p>
          <a
            href="/upgrade"
            className="mt-3 inline-flex rounded-lg px-5 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)' }}
          >
            Assinar Premium →
          </a>
        </div>

      </main>
    </div>
  );
}
