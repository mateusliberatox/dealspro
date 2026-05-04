'use client';

import { useState } from 'react';

export function UpgradeButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  async function handleClick() {
    setLoading(true);
    setError('');

    const res = await fetch('/api/stripe/checkout', { method: 'POST' });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error ?? 'Erro ao iniciar checkout');
      setLoading(false);
      return;
    }

    window.location.href = data.url;
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-600 disabled:opacity-60 transition-colors ${className}`}
      >
        {loading ? 'Aguarde...' : '⚡ Assinar Premium'}
      </button>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
