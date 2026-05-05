export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Header } from '@/components/header';

export default function SucessoPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-md px-4 py-16 space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--accent-text)' }}>Premium ativo</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Você está dentro.</h1>
          <p style={{ color: 'var(--text-2)' }}>
            Acesso em tempo real e alertas por Discord estão disponíveis agora.
          </p>
        </div>

        <ul className="space-y-4 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
          {[
            { step: '1', title: 'Configure seus alertas', desc: 'Crie alertas por palavra-chave e tamanho.', href: '/alerts', cta: 'Ir para alertas' },
            { step: '2', title: 'Use filtros avançados', desc: 'Filtre por categoria e tamanho no feed.', href: '/', cta: 'Ver feed' },
          ].map(({ step, title, desc, href, cta }) => (
            <li key={step} className="flex items-start gap-4">
              <span
                className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                style={{ background: 'var(--accent)' }}
              >
                {step}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>{desc}</p>
              </div>
              <Link href={href} className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                {cta}
              </Link>
            </li>
          ))}
        </ul>

        <Link href="/" className="btn-accent block w-full rounded-xl py-3.5 text-center font-semibold">
          Ver deals agora →
        </Link>
      </main>
    </div>
  );
}
