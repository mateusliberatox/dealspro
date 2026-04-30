'use client';

import { useState } from 'react';
import { ProductCard } from './product-card';
import type { Produto } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

export function Feed({ produtos }: { produtos: Produto[] }) {
  const [categoria, setCategoria] = useState<string>('Todos');

  const filtered = categoria === 'Todos'
    ? produtos
    : produtos.filter((p) => p.categoria === categoria);

  return (
    <div className="space-y-6">
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

      {/* Count */}
      <p className="text-sm text-neutral-500">
        {filtered.length} produto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </p>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-xl border border-white/8 bg-[#141414]">
          <p className="text-neutral-500">Nenhum produto nessa categoria ainda.</p>
        </div>
      )}
    </div>
  );
}
