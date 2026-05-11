import Link from 'next/link';

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
              {!isLoggedIn && (
                <Link
                  href="/login"
                  className="glass-btn rounded-xl px-7 py-3 text-sm font-medium"
                  style={{ color: 'var(--text-2)' }}
                >
                  Já tenho conta
                </Link>
              )}
            </div>
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
