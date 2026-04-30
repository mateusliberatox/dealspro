'use client';

import { useState, useMemo } from 'react';
import { ProductCard } from './product-card';
import type { Produto } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

export function Feed({ produtos }: { produtos: Produto[] }) {
  const [categoria, setCategoria] = useState<string>('Todos');
  const [size, setSize]           = useState<string>('');

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => p.sizes?.forEach((s) => set.add(s)));
    return [...set].sort((a, b) => {
      // Sort: letter sizes first (S,M,L…), then numeric ascending
      const aNum = Number(a), bNum = Number(b);
      if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
      if (isNaN(aNum) && !isNaN(bNum)) return -1;
      if (!isNaN(aNum) && isNaN(bNum)) return 1;
      return a.localeCompare(b);
    });
  }, [produtos]);

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      const catOk  = categoria === 'Todos' || p.categoria === categoria;
      const sizeOk = !size || p.sizes?.includes(size);
      return catOk && sizeOk;
    });
  }, [produtos, categoria, size]);

  const btnBase = 'rounded-full px-4 py-1.5 text-sm font-medium transition-all';
  const btnActive = 'bg-orange-500 text-white';
  const btnInactive = 'hover:text-white';

  const sizeBtnBase = 'rounded border px-2.5 py-0.5 text-xs font-medium transition-all';
  const sizeBtnActive = 'border-orange-500 text-orange-400';

  return (
    <div className="space-y-5">
      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoria(cat)}
            className={`${btnBase} ${categoria === cat ? btnActive : btnInactive}`}
            style={categoria === cat ? {} : { color: 'var(--text-3)', background: 'var(--surface)' }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Size filter */}
      {allSizes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--text-3)' }}>Tamanho:</span>
          <button
            onClick={() => setSize('')}
            className={`${sizeBtnBase} ${size === '' ? sizeBtnActive : ''}`}
            style={size === '' ? {} : { borderColor: 'var(--border)', color: 'var(--text-3)' }}
          >
            Todos
          </button>
          {allSizes.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s === size ? '' : s)}
              className={`${sizeBtnBase} ${size === s ? sizeBtnActive : ''}`}
              style={size === s ? {} : { borderColor: 'var(--border)', color: 'var(--text-3)' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm" style={{ color: 'var(--text-3)' }}>
        {filtered.length} produto{filtered.length !== 1 ? 's' : ''} encontrado{filtered.length !== 1 ? 's' : ''}
      </p>

      {filtered.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((p) => (
            <ProductCard key={p.id} produto={p} />
          ))}
        </div>
      ) : (
        <div
          className="flex h-40 items-center justify-center rounded-xl border"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <p style={{ color: 'var(--text-3)' }}>Nenhum produto com esses filtros.</p>
        </div>
      )}
    </div>
  );
}
