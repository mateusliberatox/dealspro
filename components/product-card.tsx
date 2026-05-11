'use client';

import { useState } from 'react';
import type { Produto } from '@/lib/types';

interface ProductCardProps {
  produto: Produto;
  featured?: boolean;
  index?: number;
}

function isNew(criado_em: string) {
  return Date.now() - new Date(criado_em).getTime() < 30 * 60 * 1000;
}

function timeAgo(criado_em: string): string {
  const diff = Date.now() - new Date(criado_em).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function Badge({ type }: { type: 'hot' | 'new' | 'time' }) {
  const configs = {
    hot:  { label: 'HOT',  cls: 'gradient-red animate-glow-red' },
    new:  { label: 'NOVO', cls: 'gradient-green animate-pulse-opacity' },
    time: { label: 'TIME', cls: 'gradient-blue animate-pulse-opacity' },
  } as const;
  const { label, cls } = configs[type];
  return (
    <span
      className={`absolute right-2 top-2 ${cls} animate-slide-in-right rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white`}
    >
      {label}
    </span>
  );
}

function isPlaceholder(url: string) {
  return /placeholder|800.?x.?900|via\.placeholder|picsum/i.test(url) || url.startsWith('data:');
}

export function ProductCard({ produto, featured = false, index = 0 }: ProductCardProps) {
  const nome       = produto.nome_traduzido || produto.nome;
  const novo       = isNew(produto.criado_em);
  const esgotado   = produto.disponivel === false;
  const badge      = esgotado ? null : featured ? 'hot' : novo ? 'new' : null;
  const delay      = `${Math.min(index * 0.055, 0.5)}s`;
  const maxSizes   = featured ? 8 : 5;
  const [imgError, setImgError] = useState(false);

  const hasValidImage = produto.imagem && !isPlaceholder(produto.imagem) && !imgError;

  return (
    <a
      href={`/go/${produto.id}`}
      className={`glass-card group flex flex-col overflow-hidden rounded-xl animate-fade-in-up ${esgotado ? 'opacity-60' : ''}`}
      style={{ animationDelay: delay }}
    >
      {/* Image area */}
      <div
        className={`relative overflow-hidden w-full ${
          featured ? 'aspect-[16/9]' : 'aspect-square'
        }`}
        style={{ background: 'var(--surface-3)' }}
      >
        {hasValidImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={produto.imagem}
            alt={nome}
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="shimmer-placeholder h-full w-full" />
        )}

        {esgotado && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.45)' }}>
            <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: 'rgba(239,68,68,0.85)' }}>
              Esgotado
            </span>
          </div>
        )}

        {badge && <Badge type={badge} />}

        <span
          className="absolute left-2 top-2 glass rounded-full px-2 py-0.5 text-[9px] font-medium"
          style={{ color: 'var(--text-3)' }}
        >
          ⏱ {timeAgo(produto.criado_em)}
        </span>
      </div>

      {/* Content */}
      <div className={`flex flex-1 flex-col ${featured ? 'p-3.5' : 'p-3'}`}>
        {produto.categoria && (
          <p
            className="mb-1.5 text-[9px] font-bold uppercase tracking-widest"
            style={{ color: 'var(--text-3)' }}
          >
            {produto.categoria}
          </p>
        )}

        <p className={`font-extrabold gradient-blue-text ${featured ? 'text-2xl' : 'text-xl'}`}>
          {produto.preco || '—'}
        </p>

        <p
          className="mt-1.5 line-clamp-2 leading-snug font-medium text-[0.8rem] group-hover:text-[var(--accent-text)] transition-colors"
          style={{ color: 'var(--text-2)' }}
        >
          {nome}
        </p>

        {produto.sizes && produto.sizes.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1">
            {produto.sizes.slice(0, maxSizes).map((s) => (
              <span
                key={s}
                className="rounded-md px-1.5 py-px text-[9px] font-medium"
                style={{
                  background:  'var(--surface-3)',
                  border:      '1px solid var(--border)',
                  color:       'var(--text-3)',
                }}
              >
                {s}
              </span>
            ))}
            {produto.sizes.length > maxSizes && (
              <span className="px-1 py-px text-[9px]" style={{ color: 'var(--text-4)' }}>
                +{produto.sizes.length - maxSizes}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-4">
          <span className="gradient-blue ripple shine-effect inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90">
            Ver deal
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6"/>
            </svg>
          </span>
        </div>
      </div>
    </a>
  );
}
