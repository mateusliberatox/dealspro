'use client';

import { useState, useMemo } from 'react';
import { ProductCard } from './product-card';
import { AdUnit } from './ad-unit';
import type { Produto } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

const AD_EVERY = 12;

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

// Nomes curtos sem emoji — produto real não usa emoji em filtros de UI
const CATEGORY_SHORT: Record<string, string> = {
  'Todos': 'Todos',
  'Smartwatch': 'Relógios',
  'Bolsa / Mochila': 'Bolsas',
  'Roupas': 'Roupas',
  'Eletrônicos': 'Eletrônicos',
  'Calçados': 'Calçados',
  'Outros': 'Outros',
};

export function Feed({ produtos, isPremium = false }: { produtos: Produto[]; isPremium?: boolean }) {
  const [categoria, setCategoria] = useState<string>('Todos');
  const [size, setSize]           = useState<string>('');

  const allSizes = useMemo(() => {
    const set = new Set<string>();
    produtos.forEach((p) => p.sizes?.forEach((s) => set.add(s)));
    return [...set].sort((a, b) => {
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

  const isFiltered = categoria !== 'Todos' || size !== '';

  return (
    <div className="space-y-5">

      {/* Filtros de categoria */}
      <div className="no-scrollbar flex gap-1 overflow-x-auto pb-0.5">
        {CATEGORIES.map((cat) => {
          const active = categoria === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className="shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
              style={
                active
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--surface-2)', color: 'var(--text-2)' }
              }
            >
              {CATEGORY_SHORT[cat] ?? cat}
            </button>
          );
        })}
      </div>

      {/* Filtro de tamanho */}
      {allSizes.length > 0 && (
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-0.5">
          <span className="shrink-0 text-[11px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
            Tam.
          </span>
          {['', ...allSizes].map((s) => (
            <button
              key={s || '__all'}
              onClick={() => setSize(s === size ? '' : s)}
              className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
              style={
                size === s
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--surface-2)', color: 'var(--text-2)' }
              }
            >
              {s || 'Todos'}
            </button>
          ))}
        </div>
      )}

      {/* Contador discreto */}
      {(isFiltered || filtered.length < produtos.length) && (
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          {filtered.length} {filtered.length === 1 ? 'produto' : 'produtos'}
          {isFiltered ? ' encontrados' : ''}
        </p>
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
              onClick={() => { setCategoria('Todos'); setSize(''); }}
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
