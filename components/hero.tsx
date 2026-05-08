interface HeroProps {
  totalDeals: number;
}

export function Hero({ totalDeals }: HeroProps) {
  const stats = [
    { icon: '⚡', label: 'Imediato' },
    { icon: '📦', label: `${totalDeals > 0 ? `${totalDeals}+` : '200+'} deals` },
    { icon: '🔥', label: 'Alertas Discord' },
  ];

  return (
    <section className="relative overflow-hidden py-14 sm:py-20 text-center">
      {/* Radial glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
        <div
          className="h-[500px] w-[800px] rounded-full"
          style={{
            background: 'radial-gradient(ellipse, rgba(59,130,246,0.09) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 space-y-6">
        <h1
          className="animate-fade-in-down text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]"
        >
          <span className="gradient-blue-text">Os melhores deals</span>
          <br />
          <span style={{ color: 'var(--text)' }}>em tempo real</span>
        </h1>

        <p
          className="animate-fade-in-up text-base sm:text-lg max-w-xl mx-auto"
          style={{ color: 'var(--text-2)', animationDelay: '0.12s' }}
        >
          Monitore novidades do CSSDeals antes de esgotar.
          Alertas instantâneos via Discord para membros premium.
        </p>

        <div
          className="animate-fade-in-up flex flex-wrap justify-center gap-3"
          style={{ animationDelay: '0.22s' }}
        >
          {stats.map(({ icon, label }, i) => (
            <span
              key={label}
              className="glass animate-scale-in rounded-full px-5 py-2.5 text-sm font-medium"
              style={{
                color: 'var(--text-2)',
                animationDelay: `${0.28 + i * 0.08}s`,
              }}
            >
              {icon}{' '}
              <span style={{ color: 'var(--text)' }}>{label}</span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
