'use client';

import { useEffect, useState } from 'react';

export function RedirectCountdown({ href, seconds }: { href: string; seconds: number }) {
  const [count, setCount] = useState(seconds);

  useEffect(() => {
    if (count <= 0) {
      window.location.href = href;
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [count, href]);

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>
        Redirecionando em <span className="font-bold text-orange-400">{count}s</span>
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block rounded-xl bg-orange-500 px-8 py-3 text-sm font-bold text-white hover:bg-orange-600 transition-colors"
      >
        Ir agora →
      </a>
    </div>
  );
}
