'use client';

import { useEffect, useState } from 'react';

export function RedirectCountdown({ href, seconds }: { href: string; seconds: number }) {
  const [count, setCount] = useState(seconds);

  useEffect(() => {
    if (count <= 0) { window.location.href = href; return; }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, href]);

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>
        Redirecionando em{' '}
        <span className="font-bold" style={{ color: 'var(--accent-text)' }}>{count}s</span>
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-accent inline-block rounded-xl px-8 py-3 text-sm font-bold"
      >
        Ir agora →
      </a>
    </div>
  );
}
