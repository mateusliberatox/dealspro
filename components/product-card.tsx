import type { Produto } from '@/lib/types';

const CATEGORY_EMOJI: Record<string, string> = {
  'Smartwatch': '⌚', 'Bolsa / Mochila': '👜', 'Roupas': '👕',
  'Eletrônicos': '🔊', 'Calçados': '👟', 'Outros': '📦',
};

function isNew(criado_em: string) {
  return Date.now() - new Date(criado_em).getTime() < 30 * 60 * 1000;
}

export function ProductCard({ produto }: { produto: Produto }) {
  const nome  = produto.nome_traduzido || produto.nome;
  const emoji = CATEGORY_EMOJI[produto.categoria ?? ''] ?? '📦';
  const novo  = isNew(produto.criado_em);

  return (
    <a
      href={produto.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-xl border transition-all"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(249,115,22,0.4)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; }}
    >
      <div className="relative aspect-square w-full overflow-hidden" style={{ background: 'var(--surface-3)' }}>
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
          <div className="flex h-full items-center justify-center text-4xl">{emoji}</div>
        )}

        {novo && (
          <span className="absolute left-2 top-2 rounded-md bg-green-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow">
            Novo
          </span>
        )}

        {produto.categoria && (
          <span className="absolute bottom-2 right-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-neutral-300 backdrop-blur-sm">
            {emoji} {produto.categoria}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug" style={{ color: 'var(--text)' }}>{nome}</p>

        {produto.nome_traduzido && produto.nome_traduzido !== produto.nome && (
          <p className="line-clamp-1 text-[11px]" style={{ color: 'var(--text-4)' }}>{produto.nome}</p>
        )}

        {produto.sizes?.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {produto.sizes.map((s) => (
              <span
                key={s}
                className="rounded px-1.5 py-0.5 text-[10px] font-medium border"
                style={{ borderColor: 'var(--border)', color: 'var(--text-3)' }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-base font-bold text-orange-400">{produto.preco || '—'}</span>
          <span className="text-[11px]" style={{ color: 'var(--text-4)' }}>
            {new Date(produto.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </a>
  );
}
