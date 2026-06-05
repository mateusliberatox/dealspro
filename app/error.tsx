'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center"
      style={{ background: 'var(--bg)' }}
    >
      <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
        Algo deu errado
      </p>
      <p className="text-sm" style={{ color: 'var(--text-3)' }}>
        Ocorreu um erro inesperado. Tente novamente.
      </p>
      <button
        onClick={reset}
        className="rounded-lg px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        style={{ background: 'var(--accent)' }}
      >
        Tentar novamente
      </button>
    </div>
  );
}
