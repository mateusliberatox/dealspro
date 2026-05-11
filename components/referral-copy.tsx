'use client';

import { useState } from 'react';

const SITE_URL = 'https://dealspro-chi.vercel.app';

export function ReferralCopy({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${SITE_URL}/r/${code}`;

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 min-w-0 rounded-lg border px-3 py-2 text-xs font-mono truncate"
        style={{ background: 'var(--surface-2)', borderColor: 'var(--border)', color: 'var(--text-3)' }}
      >
        {link}
      </div>
      <button
        onClick={copy}
        className="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition-all"
        style={{
          background: copied ? 'rgba(34,197,94,0.15)' : 'var(--accent-dim)',
          color:      copied ? '#22c55e' : 'var(--accent-text)',
          border:     `1px solid ${copied ? 'rgba(34,197,94,0.3)' : 'transparent'}`,
        }}
      >
        {copied ? '✓ Copiado' : 'Copiar'}
      </button>
    </div>
  );
}
