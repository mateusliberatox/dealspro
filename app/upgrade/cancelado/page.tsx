import Link from 'next/link';
import { Header } from '@/components/header';

export default function CanceladoPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-md px-4 py-20 text-center space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Pagamento não concluído</h1>
        <p style={{ color: 'var(--text-2)' }}>
          Você saiu antes de finalizar. Nada foi cobrado.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/upgrade" className="btn-accent block rounded-xl px-8 py-3 font-semibold">
            Tentar novamente
          </Link>
          <Link href="/" className="block rounded-xl px-8 py-3 text-sm transition-colors" style={{ color: 'var(--text-2)' }}>
            Voltar ao feed
          </Link>
        </div>
      </main>
    </div>
  );
}
