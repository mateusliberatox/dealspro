'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';
import Link from 'next/link';

const CONSENT_KEY = 'dp-cookie-consent';

export function CookieBanner() {
  const [consent, setConsent]   = useState<'accepted' | 'declined' | null>(null);
  const [visible, setVisible]   = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (stored === 'accepted' || stored === 'declined') {
      setConsent(stored as 'accepted' | 'declined');
    } else {
      // pequeno delay para não bloquear o LCP
      const t = setTimeout(() => setVisible(true), 900);
      return () => clearTimeout(t);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, 'accepted');
    setConsent('accepted');
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, 'declined');
    setConsent('declined');
    setVisible(false);
  };

  return (
    <>
      {/* AdSense só carrega após aceite explícito */}
      {consent === 'accepted' && (
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5158893095104645"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      )}

      {/* Banner */}
      {visible && (
        <div
          className="fixed bottom-0 left-0 right-0 z-[100] animate-fade-in-up"
          style={{
            background:           'rgba(15, 23, 42, 0.97)',
            backdropFilter:       'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            borderTop:            '1px solid rgba(59, 130, 246, 0.2)',
          }}
        >
          <div className="mx-auto max-w-4xl flex flex-col sm:flex-row items-start sm:items-center gap-4 px-4 py-4 sm:py-3.5">

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                🍪 Usamos cookies
              </p>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: 'var(--text-2)' }}>
                Utilizamos cookies próprios e de terceiros (incluindo Google AdSense) para melhorar sua experiência e exibir anúncios relevantes.{' '}
                <Link
                  href="/politica-de-privacidade"
                  className="underline underline-offset-2 hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--accent-text)' }}
                >
                  Política de Privacidade
                </Link>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                onClick={decline}
                className="flex-1 sm:flex-none rounded-lg px-4 py-2 text-xs font-medium transition-colors hover:opacity-80"
                style={{
                  background:  'var(--surface-2)',
                  border:      '1px solid var(--border)',
                  color:       'var(--text-2)',
                }}
              >
                Recusar
              </button>
              <button
                onClick={accept}
                className="flex-1 sm:flex-none rounded-lg px-5 py-2 text-xs font-bold text-white transition-opacity hover:opacity-90"
                style={{ background: 'var(--accent)' }}
              >
                Aceitar todos
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
