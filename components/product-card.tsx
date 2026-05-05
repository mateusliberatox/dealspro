import type { Produto } from '@/lib/types';

function isNew(criado_em: string) {
  return Date.now() - new Date(criado_em).getTime() < 30 * 60 * 1000;
}

function timeAgo(criado_em: string): string {
  const diff = Date.now() - new Date(criado_em).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function ProductCard({ produto }: { produto: Produto }) {
  const nome = produto.nome_traduzido || produto.nome;
  const novo = isNew(produto.criado_em);

  return (
    <a
      href={`/go/${produto.id}`}
      className="group flex flex-col overflow-hidden rounded-xl"
      style={{ background: 'var(--surface)' }}
    >
      {/* Imagem */}
      <div className="relative aspect-square w-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
        {produto.imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={produto.imagem}
            alt={nome}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl" style={{ color: 'var(--text-3)' }}>
            ·
          </div>
        )}

        {novo && (
          <span
            className="absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white"
            style={{ background: 'var(--accent)' }}
          >
            new
          </span>
        )}
        <span
          className="absolute right-2 top-2 text-[10px] font-medium"
          style={{ color: 'rgba(255,255,255,0.4)' }}
        >
          {timeAgo(produto.criado_em)}
        </span>
      </div>

      {/* Conteúdo */}
      <div className="flex flex-1 flex-col p-2.5">
        {/* Preço — domina */}
        <p className="text-[1.0625rem] font-bold leading-none" style={{ color: 'var(--accent-text)' }}>
          {produto.preco || '—'}
        </p>

        {/* Nome */}
        <p
          className="mt-1.5 line-clamp-2 text-[0.8125rem] leading-[1.35] font-normal"
          style={{ color: 'var(--text-2)' }}
        >
          {nome}
        </p>

        {/* Tamanhos */}
        {produto.sizes && produto.sizes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-0.5">
            {produto.sizes.slice(0, 5).map((s) => (
              <span
                key={s}
                className="rounded px-1 py-px text-[10px] font-medium"
                style={{ background: 'var(--surface-3)', color: 'var(--text-3)' }}
              >
                {s}
              </span>
            ))}
            {produto.sizes.length > 5 && (
              <span className="px-1 py-px text-[10px]" style={{ color: 'var(--text-3)' }}>
                +{produto.sizes.length - 5}
              </span>
            )}
          </div>
        )}

        <span
          className="mt-auto pt-3 text-[11px] font-medium transition-colors"
          style={{ color: 'var(--text-3)' }}
        >
          <span className="group-hover:text-[var(--accent-text)] transition-colors">Ver deal →</span>
        </span>
      </div>
    </a>
  );
}
