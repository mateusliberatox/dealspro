import type { Produto } from '@/lib/types';

const CATEGORY_EMOJI: Record<string, string> = {
  'Smartwatch': '⌚', 'Bolsa / Mochila': '👜', 'Roupas': '👕',
  'Eletrônicos': '🔊', 'Calçados': '👟', 'Outros': '📦',
};

function isNew(criado_em: string) {
  return Date.now() - new Date(criado_em).getTime() < 30 * 60 * 1000;
}

function timeAgo(criado_em: string): string {
  const diff = Date.now() - new Date(criado_em).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `há ${hrs}h`;
  return `há ${Math.floor(hrs / 24)}d`;
}

export function ProductCard({ produto }: { produto: Produto }) {
  const nome  = produto.nome_traduzido || produto.nome;
  const emoji = CATEGORY_EMOJI[produto.categoria ?? ''] ?? '📦';
  const novo  = isNew(produto.criado_em);

  return (
    <a
      href={`/go/${produto.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border transition-all duration-200"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'rgba(249,115,22,0.5)';
        el.style.background = 'var(--surface-2)';
        el.style.transform = 'translateY(-1px)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = 'var(--border)';
        el.style.background = 'var(--surface)';
        el.style.transform = 'translateY(0)';
      }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
        {produto.imagem ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={produto.imagem}
            alt={nome}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl opacity-40">{emoji}</div>
        )}

        {/* NEW badge */}
        {novo && (
          <span className="absolute left-2 top-2 rounded-md bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
            Novo
          </span>
        )}

        {/* Time ago — top right */}
        <span
          className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.55)', color: 'rgba(255,255,255,0.75)' }}
        >
          {timeAgo(produto.criado_em)}
        </span>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        {/* Category label */}
        {produto.categoria && (
          <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: 'var(--text-4)' }}>
            {emoji} {produto.categoria}
          </span>
        )}

        {/* Name */}
        <p className="line-clamp-2 text-sm font-medium leading-snug" style={{ color: 'var(--text)' }}>
          {nome}
        </p>

        {/* Sizes */}
        {produto.sizes?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {produto.sizes.slice(0, 6).map((s) => (
              <span
                key={s}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium border"
                style={{ borderColor: 'var(--border-hover)', color: 'var(--text-3)', background: 'var(--surface-3)' }}
              >
                {s}
              </span>
            ))}
            {produto.sizes.length > 6 && (
              <span className="text-[10px]" style={{ color: 'var(--text-4)' }}>+{produto.sizes.length - 6}</span>
            )}
          </div>
        )}

        {/* Price + CTA */}
        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2.5" style={{ borderColor: 'var(--border)' }}>
          <span className="text-base font-bold text-orange-400 leading-none">
            {produto.preco || '—'}
          </span>
          <span className="rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors group-hover:bg-orange-500 group-hover:text-white" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>
            Ver deal →
          </span>
        </div>
      </div>
    </a>
  );
}
