'use client';

import { useState, useMemo } from 'react';
import { ProductCard } from './product-card';
import { AdUnit } from './ad-unit';
import type { Produto } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

const AD_EVERY = 12;

const CATEGORY_SHORT: Record<string, string> = {
  'Todos':          'Todos',
  'Smartwatch':     'Relógios',
  'Bolsa / Mochila':'Bolsas',
  'Roupas':         'Roupas',
  'Eletrônicos':    'Eletrônicos',
  'Calçados':       'Calçados',
  'Outros':         'Outros',
};

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const aNum = Number(a), bNum = Number(b);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    if (isNaN(aNum) && !isNaN(bNum)) return -1;
    if (!isNaN(aNum) && isNaN(bNum)) return 1;
    return a.localeCompare(b);
  });
}

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
}

export function Feed({ produtos }: { produtos: Produto[]; isPremium?: boolean }) {
  const [categorias, setCategorias] = useState<string[]>([]);
  const [tamanhos, setTamanhos]     = useState<string[]>([]);

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => p.sizes?.forEach((s) => set.add(s)));
    return sortSizes([...set]);
  }, [produtos]);

  const toggleCat = (cat: string) => {
    if (cat === 'Todos') { setCategorias([]); return; }
    setCategorias((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  const toggleSize = (s: string) => {
    setTamanhos((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    );
  };

  const clearAll    = () => { setCategorias([]); setTamanhos([]); };
  const isFiltered  = categorias.length > 0 || tamanhos.length > 0;

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      const catOk  = categorias.length === 0 || categorias.includes(p.categoria ?? 'Outros');
      const sizeOk = tamanhos.length === 0 || p.sizes?.some((s) => tamanhos.includes(s));
      return catOk && sizeOk;
    });
  }, [produtos, categorias, tamanhos]);

  const featured   = !isFiltered && filtered.length > 0 ? filtered[0] : null;
  const rest       = featured ? filtered.slice(1) : filtered;
  const restChunks = chunk(rest, AD_EVERY);

  return (
    <div className="space-y-5">

      {/* Category filters */}
      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1 animate-fade-in-up" style={{ animationDelay: '0.08s' }}>
        <FilterBtn active={categorias.length === 0} onClick={() => toggleCat('Todos')}>
          Todos
        </FilterBtn>
        {CATEGORIES.filter((c) => c !== 'Todos').map((cat, i) => (
          <FilterBtn
            key={cat}
            active={categorias.includes(cat)}
            onClick={() => toggleCat(cat)}
            delay={`${0.1 + i * 0.04}s`}
          >
            {CATEGORY_SHORT[cat] ?? cat}
          </FilterBtn>
        ))}
      </div>

      {/* Size filters */}
      {allSizes.length > 0 && (
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <span
            className="shrink-0 mr-1 text-[9px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-3)' }}
          >
            Tam.
          </span>
          {allSizes.map((s) => (
            <FilterBtn key={s} active={tamanhos.includes(s)} onClick={() => toggleSize(s)} small>
              {s}
            </FilterBtn>
          ))}
        </div>
      )}

      {/* Active filter status */}
      {isFiltered && (
        <div className="flex items-center gap-3 animate-fade-in-up">
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}
            {categorias.length > 0 && ` · ${categorias.length} ${categorias.length === 1 ? 'categoria' : 'categorias'}`}
            {tamanhos.length > 0 && ` · ${tamanhos.length} ${tamanhos.length === 1 ? 'tamanho' : 'tamanhos'}`}
          </p>
          <button
            onClick={clearAll}
            className="text-xs underline-offset-2 transition-opacity hover:underline"
            style={{ color: 'var(--accent-text)' }}
          >
            Limpar
          </button>
        </div>
      )}

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="space-y-10">

          {/* Featured card — first product, no active filters */}
          {featured && (
            <div className="animate-scale-in" style={{ animationDelay: '0.18s' }}>
              <ProductCard produto={featured} featured index={0} />
            </div>
          )}

          {/* In-feed ad — após o featured, antes do grid. Alta intenção, scroll imediato. */}
          {featured && (
            <AdUnit slot="1621510108" format="horizontal" style={{ minHeight: 90 }} />
          )}

          {/* Regular card chunks with ads between */}
          {restChunks.map((chunkItems, gi) => (
            <div key={gi} className="space-y-8">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                {chunkItems.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    produto={p}
                    index={gi * AD_EVERY + i + (featured ? 1 : 0)}
                  />
                ))}
              </div>
              {gi < restChunks.length - 1 && (
                <AdUnit slot="1621510108" format="horizontal" style={{ minHeight: 90 }} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center animate-fade-in-up">
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
            {isFiltered
              ? 'Nenhum produto com esses filtros.'
              : 'Nenhum produto disponível no momento.'}
          </p>
          {isFiltered && (
            <button
              onClick={clearAll}
              className="mt-4 text-sm underline-offset-2 hover:underline"
              style={{ color: 'var(--accent-text)' }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  children,
  small  = false,
  delay  = '0s',
}: {
  active:    boolean;
  onClick:   () => void;
  children:  React.ReactNode;
  small?:    boolean;
  delay?:    string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 shine-effect animate-fade-in-up font-medium transition-all ${
        small ? 'rounded-md px-2.5 py-1 text-[11px]' : 'rounded-lg px-4 py-2 text-sm'
      } ${active ? 'gradient-blue-bright text-white' : 'glass-btn'}`}
      style={{
        animationDelay: delay,
        color:          active ? '#fff' : 'var(--text-2)',
      }}
    >
      {children}
    </button>
  );
}
