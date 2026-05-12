'use client';

import { useState } from 'react';

interface UpgradeButtonProps {
  className?: string;
  variant?: 'card' | 'pix';
}

export function UpgradeButton({ className, variant = 'card' }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleClick() {
    setLoading(true);
    setError('');
    if (variant === 'pix') {
      window.location.href = '/pix-checkout';
      return;
    }
    const res  = await fetch('/api/stripe/checkout', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Erro ao iniciar checkout'); setLoading(false); return; }
    window.location.href = data.url;
  }

  const label = variant === 'pix' ? '🏦 Pagar com PIX' : '💳 Assinar com Cartão';

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`rounded-xl px-6 py-3 text-sm font-bold ${variant === 'pix' ? 'btn-secondary' : 'btn-accent'} ${className ?? ''}`}
      >
        {loading ? 'Aguarde...' : label}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
