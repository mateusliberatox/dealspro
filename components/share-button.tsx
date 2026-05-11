'use client';

import { useState } from 'react';

interface Props {
  url:   string;
  title: string;
}

export function ShareButton({ url, title }: Props) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {}
    }
    // Fallback: copia para clipboard
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <button
      onClick={share}
      title="Compartilhar"
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all"
      style={{
        background:  copied ? 'rgba(34,197,94,0.12)' : 'var(--surface-2)',
        color:       copied ? '#22c55e' : 'var(--text-3)',
        border:      `1px solid ${copied ? 'rgba(34,197,94,0.25)' : 'var(--border)'}`,
      }}
    >
      {copied ? (
        <>✓ Link copiado</>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Compartilhar
        </>
      )}
    </button>
  );
}
