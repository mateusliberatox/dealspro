'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { ProductCard } from './product-card';
import { AdUnit } from './ad-unit';
import type { Produto } from '@/lib/types';
import { CATEGORIES } from '@/lib/types';

const LIVE_POLL_MS = 60_000; // 1 min — só para premium

const CATEGORY_SHORT: Record<string, string> = {
  'Todos':           'Todos',
  'Roupas':          'Roupas',
  'Calçados':        'Calçados',
  'Bolsa / Mochila': 'Bolsas',
  'Acessórios':      'Acessórios',
  'Smartwatch':      'Relógios',
  'Eletrônicos':     'Eletrônicos',
  'Outros':          'Outros',
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

function dayKey(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'America/Sao_Paulo',
  });
}

function dayLabel(dateStr: string): string {
  const key = dayKey(dateStr);
  const today     = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86_400_000).toISOString());
  if (key === today)     return 'Hoje';
  if (key === yesterday) return 'Ontem';
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo',
  });
}

interface DayGroup { key: string; label: string; items: Produto[] }

function groupByDay(produtos: Produto[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const p of produtos) {
    const k = dayKey(p.criado_em);
    const last = groups[groups.length - 1];
    if (!last || last.key !== k) {
      groups.push({ key: k, label: dayLabel(p.criado_em), items: [p] });
    } else {
      last.items.push(p);
    }
  }
  return groups;
}

export function Feed({ produtos: initial, isPremium = false }: { produtos: Produto[]; isPremium?: boolean }) {
  const [produtos, setProdutos]     = useState<Produto[]>(initial);
  const [incoming, setIncoming]     = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [tamanhos, setTamanhos]     = useState<string[]>([]);
  const [search, setSearch]         = useState('');
  const [searchQ, setSearchQ]       = useState('');
  const sinceRef = useRef<string>(initial[0]?.criado_em ?? new Date().toISOString());

  // Debounce da busca: só filtra 300ms após o usuário parar de digitar
  useEffect(() => {
    const t = setTimeout(() => setSearchQ(search.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Live feed para premium: a cada 60s busca produtos criados após o último visto.
  // Não substitui automaticamente — empurra para `incoming` e o usuário clica pra prepender.
  useEffect(() => {
    if (!isPremium) return;
    let cancelled = false;

    const poll = async () => {
      try {
        const r = await fetch(`/api/products?since=${encodeURIComponent(sinceRef.current)}&limit=50`, { cache: 'no-store' });
        if (!r.ok) return;
        const data = await r.json() as { produtos: Produto[] };
        const novos = data.produtos ?? [];
        if (cancelled || novos.length === 0) return;
        sinceRef.current = novos[0].criado_em;
        setIncoming((prev) => {
          const seen = new Set([...prev, ...produtos].map((p) => p.id));
          return [...novos.filter((p) => !seen.has(p.id)), ...prev];
        });
      } catch { /* silencia falhas de rede transientes */ }
    };

    const interval = setInterval(poll, LIVE_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isPremium, produtos]);

  const revealIncoming = () => {
    setProdutos((prev) => {
      const seen = new Set(prev.map((p) => p.id));
      const novos = incoming.filter((p) => !seen.has(p.id));
      return [...novos, ...prev];
    });
    setIncoming([]);
  };

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

  const clearAll   = () => { setCategorias([]); setTamanhos([]); setSearch(''); };
  const isFiltered = categorias.length > 0 || tamanhos.length > 0 || searchQ.length > 0;

  const filtered = useMemo(() => {
    return produtos.filter((p) => {
      const catOk    = categorias.length === 0 || categorias.includes(p.categoria ?? 'Outros');
      const sizeOk   = tamanhos.length === 0 || p.sizes?.some((s) => tamanhos.includes(s));
      const searchOk = !searchQ || (p.nome_traduzido ?? p.nome).toLowerCase().includes(searchQ);
      return catOk && sizeOk && searchOk;
    });
  }, [produtos, categorias, tamanhos, searchQ]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <div className="space-y-5">

      {/* Live indicator + novos deals (só premium) */}
      {isPremium && (
        <div className="flex items-center justify-between gap-3">
          <span
            className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--accent-text)' }}
          >
            <span className="relative inline-flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: '#22c55e' }} />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: '#22c55e' }} />
            </span>
            Ao vivo
          </span>
          {incoming.length > 0 && (
            <button
              type="button"
              onClick={revealIncoming}
              className="gradient-blue-bright ripple shine-effect rounded-full px-4 py-1.5 text-xs font-bold text-white transition-opacity hover:opacity-90 animate-fade-in-up"
            >
              ↑ {incoming.length} {incoming.length === 1 ? 'novo deal' : 'novos deals'}
            </button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="relative animate-fade-in-up" style={{ animationDelay: '0.06s' }}>
        <span
          className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm"
          style={{ color: 'var(--text-3)' }}
        >
          🔍
        </span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar produto…"
          className="glass-btn w-full rounded-lg py-2 pl-9 pr-4 text-sm outline-none focus:ring-1"
          style={{ color: 'var(--text)', caretColor: 'var(--accent-text)' }}
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute inset-y-0 right-3 flex items-center text-xs"
            style={{ color: 'var(--text-3)' }}
          >
            ✕
          </button>
        )}
      </div>

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
            {searchQ && ` · "${searchQ}"`}
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

      {/* Day groups */}
      {groups.length > 0 ? (
        <div className="space-y-10">
          {groups.map((group, gi) => {
            // Apenas o primeiro card do primeiro grupo recebe destaque featured
            const featured = gi === 0 && !isFiltered && group.items.length > 0
              ? group.items[0]
              : null;
            const items = featured ? group.items.slice(1) : group.items;
            let cardIndex = featured ? 1 : 0;

            return (
              <div key={group.key} className="space-y-4">

                {/* Date header */}
                <div className="flex items-center gap-3 animate-fade-in-up">
                  <span
                    className="text-sm font-semibold"
                    style={{ color: 'var(--text)' }}
                  >
                    {group.label}
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                    {group.items.length} {group.items.length === 1 ? 'produto' : 'produtos'}
                  </span>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                  {featured && (
                    <div className="col-span-2 animate-scale-in" style={{ animationDelay: '0.18s' }}>
                      <ProductCard produto={featured} featured index={0} />
                    </div>
                  )}
                  {items.map((p, i) => (
                    <ProductCard
                      key={p.id}
                      produto={p}
                      index={cardIndex++}
                    />
                  ))}
                </div>

                {/* Ad entre grupos (exceto após o último) */}
                {gi < groups.length - 1 && (
                  <AdUnit slot="1621510108" format="horizontal" style={{ minHeight: 90 }} />
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-24 text-center animate-fade-in-up">
          <p className="text-4xl mb-4">🔍</p>
          <p className="text-sm font-medium" style={{ color: 'var(--text-2)' }}>
            {isFiltered
              ? searchQ && !categorias.length && !tamanhos.length
                ? `Nenhum resultado para "${searchQ}".`
                : 'Nenhum produto com esses filtros.'
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
