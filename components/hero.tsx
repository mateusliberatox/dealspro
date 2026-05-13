import Link from 'next/link';

const DISCORD_INVITE = 'https://discord.gg/dBXRdqM2Z';

interface HeroProps {
  totalDeals:   number;
  premiumCount: number;
  isLoggedIn:   boolean;
  isPremium:    boolean;
}

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Scraper detecta',
    desc:  'Monitoramos o CSSDeals a cada 2 minutos e identificamos produtos novos automaticamente.',
  },
  {
    step: '02',
    title: 'Premium recebe na hora',
    desc:  'Membros premium veem o produto imediatamente no feed e recebem DM no Discord.',
  },
  {
    step: '03',
    title: 'Free acessa depois',
    desc:  'Após 30 minutos o produto aparece para usuários gratuitos — se ainda houver estoque.',
  },
];

export function Hero({ totalDeals, premiumCount, isLoggedIn, isPremium }: HeroProps) {
  const stats = [
    { icon: '⚡', label: 'Alertas imediatos' },
    { icon: '📦', label: `${totalDeals > 0 ? `${totalDeals}+` : '200+'} deals monitorados` },
    { icon: '⏱️', label: 'Atualizado a cada 2 min' },
  ];

  return (
    <>
      {/* ── Hero principal ── */}
      <section className="relative overflow-hidden py-14 sm:py-20 text-center">
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <div
            className="h-[600px] w-[900px] rounded-full"
            style={{ background: 'radial-gradient(ellipse, rgba(59,130,246,0.1) 0%, transparent 70%)' }}
          />
        </div>

        <div className="relative mx-auto max-w-3xl px-4 space-y-6">
          <h1 className="animate-fade-in-down text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1]">
            <span className="gradient-blue-text">Nunca mais perca</span>
            <br />
            <span style={{ color: 'var(--text)' }}>um deal do CSSDeals</span>
          </h1>

          <p
            className="animate-fade-in-up text-base sm:text-lg max-w-xl mx-auto"
            style={{ color: 'var(--text-2)', animationDelay: '0.1s' }}
          >
            Monitore novos produtos em tempo real, configure alertas por palavra-chave
            e receba notificações direto no Discord antes que esgote.
          </p>

          {/* Stats */}
          <div className="animate-fade-in-up flex flex-wrap justify-center gap-3" style={{ animationDelay: '0.2s' }}>
            {stats.map(({ icon, label }, i) => (
              <span
                key={label}
                className="glass animate-scale-in rounded-full px-5 py-2.5 text-sm font-medium"
                style={{ color: 'var(--text-2)', animationDelay: `${0.25 + i * 0.07}s` }}
              >
                {icon}{' '}<span style={{ color: 'var(--text)' }}>{label}</span>
              </span>
            ))}
          </div>

          {/* CTA */}
          {!isPremium && (
            <div className="animate-fade-in-up flex flex-wrap justify-center gap-3" style={{ animationDelay: '0.4s' }}>
              <Link
                href={isLoggedIn ? '/upgrade' : '/login'}
                className="gradient-blue-bright ripple shine-effect rounded-xl px-7 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
              >
                {isLoggedIn ? 'Assinar Premium — R$ 7,99/mês' : 'Começar grátis'}
              </Link>
              <a
                href={DISCORD_INVITE}
                target="_blank"
                rel="noopener noreferrer"
                className="glass-btn ripple rounded-xl px-7 py-3 text-sm font-medium flex items-center gap-2 transition-all"
                style={{ color: 'var(--text-2)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2" aria-hidden>
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
                </svg>
                Entrar no Discord
              </a>
            </div>
          )}

          {/* Teaser de indicação — só para não-logados */}
          {!isLoggedIn && (
            <p className="animate-fade-in-up text-sm" style={{ color: 'var(--text-3)', animationDelay: '0.45s' }}>
              💰 Indique amigos e ganhe{' '}
              <Link href="/login" className="font-semibold underline-offset-2 hover:underline" style={{ color: 'var(--accent-text)' }}>
                1 mês de Premium grátis
              </Link>
            </p>
          )}

          {/* Prova social */}
          {premiumCount > 0 && (
            <p className="animate-fade-in-up text-sm" style={{ color: 'var(--text-3)', animationDelay: '0.5s' }}>
              🔥 <strong style={{ color: 'var(--text-2)' }}>{premiumCount} {premiumCount === 1 ? 'membro' : 'membros'}</strong> já com acesso Premium
            </p>
          )}
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section className="mx-auto max-w-6xl px-4 pb-12">
        <h2 className="mb-8 text-center text-lg font-bold" style={{ color: 'var(--text)' }}>
          Como funciona
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map(({ step, title, desc }) => (
            <div
              key={step}
              className="glass rounded-2xl p-5 space-y-3 animate-fade-in-up"
            >
              <span
                className="text-3xl font-black gradient-blue-text"
              >
                {step}
              </span>
              <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{title}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-3)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
