export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Header } from '@/components/header';

export default function SucessoPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-md px-4 py-20 text-center space-y-6">
        <div className="text-6xl">🎉</div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Bem-vindo ao Premium!
        </h1>
        <p style={{ color: 'var(--text-3)' }}>
          Sua assinatura foi ativada. Você já tem acesso em tempo real a todos os produtos.
        </p>
        <Link
          href="/"
          className="inline-block rounded-xl bg-orange-500 px-8 py-3 font-semibold text-white hover:bg-orange-600 transition-colors"
        >
          Ver produtos agora
        </Link>
      </main>
    </div>
  );
}
