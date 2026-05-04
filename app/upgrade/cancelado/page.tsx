import Link from 'next/link';
import { Header } from '@/components/header';

export default function CanceladoPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-md px-4 py-20 text-center space-y-6">
        <div className="text-6xl">😕</div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
          Pagamento não concluído
        </h1>
        <p style={{ color: 'var(--text-3)' }}>
          Você saiu antes de finalizar. Não se preocupe — nada foi cobrado.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/upgrade"
            className="inline-block rounded-xl bg-orange-500 px-8 py-3 font-semibold text-white hover:bg-orange-600 transition-colors"
          >
            Tentar novamente
          </Link>
          <Link
            href="/"
            className="inline-block rounded-xl px-8 py-3 text-sm transition-colors"
            style={{ color: 'var(--text-3)' }}
          >
            Voltar ao feed
          </Link>
        </div>
      </main>
    </div>
  );
}
