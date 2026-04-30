'use client';

import { useState, useMemo } from 'react';
import { ProductCard } from './product-card';
import type { Produto } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

export function Feed({ produtos }: { produtos: Produto[] }) {
  const [categoria, setCategoria] = useState<string>('Todos');
  const [size, setSize]           = useState<string>('');

  // Collect unique sizes across all products (only show filter if any exist)
  const allSizes = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => p.sizes?.forEach((s) => set.add(s)));
    return [...set].sort();
  }, [produtos]);

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      const catOk  = categoria === 'Todos' || p.categoria === categoria;
      const sizeOk = !size || p.sizes?.includes(size);
      return catOk && sizeOk;
    });
  }, [produtos, categoria, size]);

  return (
    <div className="space-y-5">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoria(cat)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
              categoria === cat
                ? 'bg-orange-500 text-white'
                : 'bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-neutral-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Size filter — only shown when products with sizes exist */}
      {allSizes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-neutral-500">Tamanho:</span>
          <button
            onClick={() => setSize('')}
            className={`rounded border px-2.5 py-0.5 text-xs font-medium transition-all ${
              size === ''
                ? 'border-orange-500 text-orange-400'
                : 'border-white/10 text-neutral-400 hover:border-white/30'
            }`}
          >
            Todos
          </button>
          {allSizes.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s === size ? '' : s)}
              className={`rounded border px-2.5 py-0.5 text-xs font-medium transition-all ${
                size === s
                  ? 'border-orange-500 text-orange-400'
                  : 'border-white/10 text-neutral-400 hover:border-white/30'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-neutral-500">
        {filtered.length} produto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </p>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-white/8 bg-[#141414]">
          <p className="text-neutral-500">Nenhum produto com esses filtros.</p>
        </div>
      )}
    </div>
  );
}
