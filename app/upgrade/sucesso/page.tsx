export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Header } from '@/components/header';

export default function SucessoPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-md px-4 py-16 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="text-6xl">🎉</div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            Bem-vindo ao Premium!
          </h1>
          <p style={{ color: 'var(--text-3)' }}>
            Sua assinatura está ativa. Você já tem acesso em tempo real a todos os deals.
          </p>
        </div>

        {/* Próximos passos */}
        <div
          className="rounded-2xl border divide-y overflow-hidden"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          {[
            {
              step: '1', icon: '🔔', title: 'Configure seus alertas',
              desc: 'Crie alertas por palavra-chave e receba DMs no Discord quando o produto aparecer.',
              href: '/alerts', cta: 'Ir para alertas',
            },
            {
              step: '2', icon: '📐', title: 'Use filtros por tamanho',
              desc: 'No feed, filtre os produtos pelo seu tamanho para encontrar só o que cabe em você.',
              href: '/', cta: 'Ver feed',
            },
          ].map(({ step, icon, title, desc, href, cta }) => (
            <div key={step} className="flex items-start gap-4 px-5 py-4">
              <span className="shrink-0 flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/15 text-sm font-bold text-orange-400">
                {step}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  {icon} {title}
                </p>
                <p className="mt-0.5 text-xs" style={{ color: 'var(--text-3)' }}>{desc}</p>
              </div>
              <Link
                href={href}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
              >
                {cta}
              </Link>
            </div>
          ))}
        </div>

        {/* CTA principal */}
        <Link
          href="/"
          className="block w-full rounded-xl bg-orange-500 py-3.5 text-center font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          Ver deals agora →
        </Link>

      </main>
    </div>
  );
}
