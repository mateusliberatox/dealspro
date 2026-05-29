'use client';

import { useState } from 'react';
import type { OrderRow } from '@/app/pedidos/page';
import type { TrackingStatus } from '@/lib/tracking';

const STATUS_COLOR: Record<string, string> = {
  pending:          'var(--text-3)',
  in_transit:       '#3b82f6',
  customs:          '#f59e0b',
  out_for_delivery: '#8b5cf6',
  delivered:        '#10b981',
  failed:           '#ef4444',
  returned:         '#f97316',
};

interface Props {
  initialOrders: OrderRow[];
  isPremium:     boolean;
  limit:         number;
  statusLabels:  Record<TrackingStatus, string>;
  statusEmoji:   Record<TrackingStatus, string>;
}

export function OrdersPanel({ initialOrders, isPremium, limit, statusLabels, statusEmoji }: Props) {
  const [orders,  setOrders]  = useState<OrderRow[]>(initialOrders);
  const [code,    setCode]    = useState('');
  const [desc,    setDesc]    = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const active    = orders.filter((o) => !['delivered', 'failed', 'returned'].includes(o.status));
  const finalized = orders.filter((o) =>  ['delivered', 'failed', 'returned'].includes(o.status));
  const atLimit   = active.length >= limit;

  const addOrder = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    try {
      const res  = await fetch('/api/pedidos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tracking_code: code.trim(), description: desc.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Erro ao adicionar encomenda.'); return; }
      setOrders((prev) => [data.order as OrderRow, ...prev]);
      setCode('');
      setDesc('');
    } catch { setError('Erro de conexão.'); }
    finally  { setLoading(false); }
  };

  const removeOrder = async (id: string) => {
    if (!confirm('Remover esta encomenda do rastreamento?')) return;
    const res = await fetch(`/api/pedidos?id=${id}`, { method: 'DELETE' });
    if (res.ok) setOrders((prev) => prev.filter((o) => o.id !== id));
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-6">

      {/* Adicionar nova encomenda */}
      {!atLimit && (
        <div
          className="rounded-xl p-4 space-y-3 animate-fade-in-up"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            Adicionar encomenda
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="Código de rastreio (ex: AB123456789BR)"
              className="glass-btn flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ color: 'var(--text)', minWidth: 0 }}
              onKeyDown={(e) => e.key === 'Enter' && addOrder()}
            />
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Descrição (opcional — ex: Nike Air Max 42 Preto)"
              className="glass-btn flex-1 rounded-lg px-3 py-2 text-sm outline-none"
              style={{ color: 'var(--text)', minWidth: 0 }}
            />
            <button
              onClick={addOrder}
              disabled={loading || !code.trim()}
              className="gradient-blue-bright ripple rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? '…' : 'Adicionar'}
            </button>
          </div>
          {error && <p className="text-xs" style={{ color: '#ef4444' }}>{error}</p>}
        </div>
      )}

      {atLimit && (
        <div
          className="rounded-xl p-3 text-sm animate-fade-in-up"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-3)' }}
        >
          Limite de {limit} encomendas ativas atingido.
          {!isPremium && ' Assine o Premium para mais slots.'}
        </div>
      )}

      {/* Encomendas ativas */}
      {active.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-2)' }}>
            Em andamento ({active.length})
          </h2>
          {active.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              statusLabels={statusLabels}
              statusEmoji={statusEmoji}
              onRemove={removeOrder}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      {/* Encomendas finalizadas */}
      {finalized.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-3)' }}>
            Finalizadas ({finalized.length})
          </h2>
          {finalized.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              statusLabels={statusLabels}
              statusEmoji={statusEmoji}
              onRemove={removeOrder}
              formatDate={formatDate}
              dimmed
            />
          ))}
        </div>
      )}

      {orders.length === 0 && (
        <div className="py-20 text-center animate-fade-in-up">
          <p className="text-4xl mb-4">📦</p>
          <p className="text-sm" style={{ color: 'var(--text-2)' }}>
            Nenhuma encomenda cadastrada ainda.
          </p>
          <p className="mt-1 text-xs" style={{ color: 'var(--text-3)' }}>
            Adicione o código de rastreio acima ou use <code>/rastrear</code> no Discord.
          </p>
        </div>
      )}
    </div>
  );
}

function OrderCard({
  order, statusLabels, statusEmoji, onRemove, formatDate, dimmed = false,
}: {
  order:        OrderRow;
  statusLabels: Record<string, string>;
  statusEmoji:  Record<string, string>;
  onRemove:     (id: string) => void;
  formatDate:   (iso: string | null) => string | null;
  dimmed?:      boolean;
}) {
  const color = STATUS_COLOR[order.status] ?? 'var(--text-3)';
  const emoji = statusEmoji[order.status] ?? '📦';
  const label = statusLabels[order.status] ?? order.status;

  return (
    <div
      className="rounded-xl p-4 animate-fade-in-up"
      style={{
        background: 'var(--surface)',
        border:     `1px solid var(--border)`,
        opacity:    dimmed ? 0.7 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {order.description && (
            <p className="font-semibold text-sm truncate mb-0.5" style={{ color: 'var(--text)' }}>
              {order.description}
            </p>
          )}
          <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
            {order.tracking_code}
          </p>
        </div>
        <button
          onClick={() => onRemove(order.id)}
          className="shrink-0 rounded p-1 transition-opacity hover:opacity-70"
          style={{ color: 'var(--text-3)' }}
          title="Remover"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
          </svg>
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className="text-base">{emoji}</span>
        <span className="text-sm font-medium" style={{ color }}>{label}</span>
      </div>

      {order.last_event && (
        <p className="mt-2 text-xs leading-relaxed" style={{ color: 'var(--text-3)' }}>
          {order.last_event}
          {order.last_event_at && (
            <span className="ml-1">· {formatDate(order.last_event_at)}</span>
          )}
        </p>
      )}
    </div>
  );
}
