'use client';

import { useState, useMemo } from 'react';
import { ProductCard } from './product-card';
import { AdUnit } from './ad-unit';
import type { Produto } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

const AD_EVERY = 12;

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

const CATEGORY_SHORT: Record<string, string> = {
  'Todos': 'Todos',
  'Smartwatch': 'Relógios',
  'Bolsa / Mochila': 'Bolsas',
  'Roupas': 'Roupas',
  'Eletrônicos': 'Eletrônicos',
  'Calçados': 'Calçados',
  'Outros': 'Outros',
};

// Ordena tamanhos: letras antes (XS→5XL), depois números crescente
function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const aNum = Number(a), bNum = Number(b);
    if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
    if (isNaN(aNum) && !isNaN(bNum)) return -1;
    if (!isNaN(aNum) && isNaN(bNum)) return 1;
    return a.localeCompare(b);
  });
}

export function Feed({ produtos, isPremium = false }: { produtos: Produto[]; isPremium?: boolean }) {
  // Multi-seleção: arrays vazios = sem filtro = mostra tudo
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

  const clearAll = () => { setCategorias([]); setTamanhos([]); };

  const isFiltered = categorias.length > 0 || tamanhos.length > 0;

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      const catOk  = categorias.length === 0 || categorias.includes(p.categoria ?? 'Outros');
      const sizeOk = tamanhos.length === 0 || p.sizes?.some((s) => tamanhos.includes(s));
      return catOk && sizeOk;
    });
  }, [produtos, categorias, tamanhos]);

  const filterBtnStyle = (active: boolean) =>
    active
      ? { background: 'var(--accent)', color: '#fff' }
      : { background: 'var(--surface-2)', color: 'var(--text-2)' };

  return (
    <div className="space-y-4">

      {/* Filtro de categoria — multi-seleção */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto pb-0.5">
        {/* Todos: limpa a seleção, ativo quando nada selecionado */}
        <button
          onClick={() => toggleCat('Todos')}
          className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
          style={filterBtnStyle(categorias.length === 0)}
        >
          Todos
        </button>
        {CATEGORIES.filter((c) => c !== 'Todos').map((cat) => (
          <button
            key={cat}
            onClick={() => toggleCat(cat)}
            className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            style={filterBtnStyle(categorias.includes(cat))}
          >
            {CATEGORY_SHORT[cat] ?? cat}
          </button>
        ))}
      </div>

      {/* Filtro de tamanho — multi-seleção */}
      {allSizes.length > 0 && (
        <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-widest mr-0.5" style={{ color: 'var(--text-3)' }}>
            Tam.
          </span>
          {allSizes.map((s) => (
            <button
              key={s}
              onClick={() => toggleSize(s)}
              className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              style={filterBtnStyle(tamanhos.includes(s))}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Barra de estado dos filtros ativos */}
      {isFiltered && (
        <div className="flex items-center gap-3">
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}
            {categorias.length > 0 && ` · ${categorias.length} ${categorias.length === 1 ? 'categoria' : 'categorias'}`}
            {tamanhos.length > 0 && ` · ${tamanhos.length} ${tamanhos.length === 1 ? 'tamanho' : 'tamanhos'}`}
          </p>
          <button
            onClick={clearAll}
            className="text-xs underline-offset-2 hover:underline transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            Limpar
          </button>
        </div>
      )}

      {/* Grade */}
      {filtered.length > 0 ? (
        <div className="space-y-8">
          {chunk(filtered, AD_EVERY).map((group, gi) => (
            <div key={gi}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
                {group.map((p) => (
                  <ProductCard key={p.id} produto={p} />
                ))}
              </div>
              {gi < Math.ceil(filtered.length / AD_EVERY) - 1 && (
                <AdUnit slot="1621510108" format="horizontal" className="mt-6" style={{ minHeight: 90 }} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-20 text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
            {isFiltered ? 'Nenhum produto com esses filtros.' : 'Nenhum produto disponível no momento.'}
          </p>
          {isFiltered && (
            <button
              onClick={clearAll}
              className="mt-3 text-sm underline-offset-2 hover:underline"
              style={{ color: 'var(--accent)' }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
