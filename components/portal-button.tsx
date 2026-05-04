'use client';

import { useState } from 'react';

export function PortalButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    setLoading(true);
    const res = await fetch('/api/stripe/portal', { method: 'POST' });
    const { url, error } = await res.json();
    if (error) { alert(error); setLoading(false); return; }
    window.location.href = url;
  };

  return (
    <button
      onClick={openPortal}
      disabled={loading}
      className={`rounded-lg border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${className ?? ''}`}
      style={{ borderColor: 'var(--border)', color: 'var(--text-2)' }}
    >
      {loading ? 'Carregando...' : 'Gerenciar assinatura'}
    </button>
  );
}
