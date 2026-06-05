import Link from 'next/link';

const DISCORD_INVITE = 'https://discord.gg/dBXRdqM2Z';

interface HeroProps {
  totalDeals:   number;
  premiumCount: number;
  isLoggedIn:   boolean;
  isPremium:    boolean;
}

export function Hero({ totalDeals, premiumCount, isLoggedIn, isPremium }: HeroProps) {
  // Usuário premium logado: sem hero — vai direto pro feed
  if (isPremium) return null;

  return (
    <section
      className="relative overflow-hidden border-b animate-fade-in-down"
      style={{ borderColor: 'rgba(59,130,246,0.12)' }}
    >
      {/* Glow sutil */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute -top-20 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full"
          style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative mx-auto max-w-screen-2xl px-4 py-6 sm:py-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

          {/* Texto */}
          <div className="space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-snug">
              <span className="gradient-blue-text">Nunca mais perca</span>{' '}
              <span style={{ color: 'var(--text)' }}>um deal do CSSDeals</span>
            </h1>
            <p className="text-sm max-w-lg" style={{ color: 'var(--text-3)' }}>
              Monitore produtos em tempo real · alertas por DM no Discord · acesso 30 min antes dos gratuitos
            </p>
            {premiumCount > 0 && (
              <p className="text-xs" style={{ color: 'var(--text-4)' }}>
                🔥 <strong style={{ color: 'var(--text-3)' }}>{premiumCount}</strong> membros Premium ativos ·{' '}
                <strong style={{ color: 'var(--text-3)' }}>{totalDeals > 0 ? `${totalDeals}+` : '800+'}</strong> deals monitorados
              </p>
            )}
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isLoggedIn ? (
              <>
                <Link
                  href="/login"
                  className="gradient-blue-bright ripple shine-effect rounded-lg px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
                >
                  Começar grátis
                </Link>
                <a
                  href={DISCORD_INVITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="glass-btn rounded-lg px-4 py-2.5 text-sm font-medium flex items-center gap-2"
                  style={{ color: 'var(--text-2)' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--discord-color)" aria-hidden>
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                  </svg>
                  Discord
                </a>
              </>
            ) : (
              <Link
                href="/upgrade"
                className="gradient-blue-bright ripple shine-effect rounded-lg px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                ⭐ Assinar Premium — R$ 7,99/mês
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
