'use client';

import { useState, useMemo } from 'react';
import { ProductCard } from './product-card';
import { AdUnit } from './ad-unit';
import type { Produto } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

const AD_EVERY = 12;

const CATEGORY_LABEL: Record<string, string> = {
  'Todos': 'Todos',
  'Smartwatch': '⌚ Smartwatch',
  'Bolsa / Mochila': '👜 Bolsa',
  'Roupas': '👕 Roupas',
  'Eletrônicos': '🔊 Eletrônicos',
  'Calçados': '👟 Calçados',
  'Outros': '📦 Outros',
};

const chunk = <T,>(arr: T[], size: number): T[][] =>
  Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size));

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
    <div className="space-y-4">
      {/* Category filter */}
      <div
        className="flex gap-1.5 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        {CATEGORIES.map((cat) => {
          const active = categoria === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategoria(cat)}
              className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all"
              style={
                active
                  ? { background: 'var(--accent)', color: '#fff' }
                  : { background: 'var(--surface)', color: 'var(--text-3)', borderWidth: 1, borderColor: 'var(--border)' }
              }
            >
              {CATEGORY_LABEL[cat] ?? cat}
            </button>
          );
        })}
      </div>

      {/* Size filter — horizontal scroll on mobile */}
      {allSizes.length > 0 && (
        <div
          className="flex items-center gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          <span className="shrink-0 text-xs font-medium" style={{ color: 'var(--text-4)' }}>Tamanho</span>
          <button
            onClick={() => setSize('')}
            className="shrink-0 rounded border px-2.5 py-1 text-xs font-medium transition-all"
            style={
              size === ''
                ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'rgba(249,115,22,0.08)' }
                : { borderColor: 'var(--border)', color: 'var(--text-3)' }
            }
          >
            Todos
          </button>
          {allSizes.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s === size ? '' : s)}
              className="shrink-0 rounded border px-2.5 py-1 text-xs font-medium transition-all"
              style={
                size === s
                  ? { borderColor: 'var(--accent)', color: 'var(--accent)', background: 'rgba(249,115,22,0.08)' }
                  : { borderColor: 'var(--border)', color: 'var(--text-3)' }
              }
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs" style={{ color: 'var(--text-4)' }}>
        {filtered.length} produto{filtered.length !== 1 ? 's' : ''}
        {isFiltered && ' com os filtros selecionados'}
      </p>

      {/* Grid */}
      {filtered.length > 0 ? (
        <div className="space-y-6">
          {chunk(filtered, AD_EVERY).map((group, gi) => (
            <div key={gi}>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {group.map((p) => (
                  <ProductCard key={p.id} produto={p} />
                ))}
              </div>
              {gi < Math.ceil(filtered.length / AD_EVERY) - 1 && (
                <AdUnit slot="1621510108" format="horizontal" className="mt-4" style={{ minHeight: 90 }} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl border py-16 text-center"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <span className="text-4xl opacity-40">🔍</span>
          <p className="font-medium" style={{ color: 'var(--text-2)' }}>Nenhum produto encontrado</p>
          <p className="text-sm" style={{ color: 'var(--text-4)' }}>
            {isFiltered
              ? 'Tente remover ou trocar os filtros.'
              : 'Os produtos aparecerão assim que forem detectados.'}
          </p>
          {isFiltered && (
            <button
              onClick={() => { setCategoria('Todos'); setSize(''); }}
              className="mt-1 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
              style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}
