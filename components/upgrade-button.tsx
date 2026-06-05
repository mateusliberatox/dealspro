'use client';

import { useState } from 'react';

interface UpgradeButtonProps {
  className?: string;
  variant?: 'card' | 'pix';
  plan?: 'monthly' | 'annual';
}

export function UpgradeButton({ className, variant = 'card', plan = 'monthly' }: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleClick() {
    setLoading(true);
    setError('');
    if (variant === 'pix') {
      window.location.href = '/pix-checkout';
      return;
    }
    const res  = await fetch('/api/stripe/checkout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ plan }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Erro ao iniciar checkout'); setLoading(false); return; }
    window.location.href = data.url;
  }

  const label = variant === 'pix'
    ? '🏦 Pagar com PIX'
    : plan === 'annual'
    ? '💳 Assinar Anual'
    : '💳 Assinar com Cartão';

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
