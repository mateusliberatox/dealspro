import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { getApprovedSellers } from '@/lib/sellers';

export const revalidate = 3600;

const DISCORD_INVITE = 'https://discord.gg/dBXRdqM2Z';

export const metadata: Metadata = {
  title: 'Vendedores Confiáveis · Taobao, Goofish e Weidian',
  description: 'Veja a avaliação de vendedores chineses (Taobao, Goofish, 1688, Weidian) feita pela comunidade DealsPro no Discord, antes de comprar.',
};

function renderStars(avg: number) {
  const rounded = Math.round(avg);
  return '⭐'.repeat(rounded) + '☆'.repeat(Math.max(0, 5 - rounded));
}

export default async function VendedoresPage() {
  const sellers = await getApprovedSellers();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-12 space-y-8">

        <div className="space-y-2 animate-fade-in-up">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Vendedores Confiáveis
          </h1>
          <p className="text-sm max-w-2xl" style={{ color: 'var(--text-3)' }}>
            Avaliações reais feitas pela comunidade DealsPro no Discord (comando{' '}
            <code className="rounded px-1 py-0.5 text-xs" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
              /avaliar-seller
            </code>
            ) sobre vendedores do Taobao, Goofish, 1688 e Weidian — use como referência antes de fechar uma compra.
          </p>
        </div>

        {sellers.length > 0 ? (
          <div className="space-y-3 animate-fade-in-up">
            {sellers.map((seller) => (
              <div
                key={seller.id}
                className="rounded-xl border p-4 space-y-2"
                style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="font-bold text-sm" style={{ color: 'var(--text)' }}>{seller.name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" title={`${seller.avg}/5`}>{renderStars(seller.avg)}</span>
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-2)' }}>
                      {seller.avg}/5
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-4)' }}>
                      ({seller.total} avaliação{seller.total !== 1 ? 'ões' : ''})
                    </span>
                  </div>
                </div>
                {seller.recentComments.length > 0 && (
                  <ul className="space-y-1 border-t pt-2" style={{ borderColor: 'var(--border)' }}>
                    {seller.recentComments.map((c, i) => (
                      <li key={i} className="text-xs italic" style={{ color: 'var(--text-3)' }}>
                        &ldquo;{c}&rdquo;
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="rounded-xl border p-6 text-center text-sm animate-fade-in-up"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
          >
            Ainda não há vendedores avaliados. Seja o primeiro a avaliar no Discord!
          </div>
        )}

        <div
          className="rounded-xl border p-5 space-y-3 animate-fade-in-up"
          style={{ background: 'var(--accent-dim)', borderColor: 'var(--border-strong)' }}
        >
          <p className="text-sm font-bold" style={{ color: 'var(--accent-text)' }}>
            Quer avaliar um vendedor ou sugerir um novo?
          </p>
          <p className="text-xs" style={{ color: 'var(--text-2)' }}>
            Entre no nosso Discord e use{' '}
            <code className="rounded px-1 py-0.5" style={{ background: 'var(--surface-2)' }}>/avaliar-seller</code>{' '}
            para dar sua nota e comentário, ou{' '}
            <code className="rounded px-1 py-0.5" style={{ background: 'var(--surface-2)' }}>/seller</code>{' '}
            para consultar a reputação de um vendedor antes de comprar.
          </p>
          <a
            href={DISCORD_INVITE}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg px-4 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: 'var(--discord-color)' }}
          >
            Entrar no Discord →
          </a>
        </div>

        <p className="text-xs" style={{ color: 'var(--text-4)' }}>
          ⚠️ As avaliações são opiniões da comunidade e não substituem sua própria pesquisa antes de comprar.
        </p>
      </main>
    </div>
  );
}
