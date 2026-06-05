export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';

export default async function SucessoPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('plan, discord_user_id, discord_username')
    .eq('user_id', user.id)
    .single();

  const hasDiscord = !!profile?.discord_user_id;
  const isPremium  = profile?.plan === 'premium';

  // Se ainda não constou como premium (webhook + polling ainda processando),
  // mostra estado de processamento ao invés de mensagem falsa de sucesso.
  if (!isPremium) {
    return (
      <div className="min-h-screen">
        <Header />
        <main className="mx-auto max-w-md px-4 py-16 space-y-6 text-center">
          <div className="mx-auto w-10 h-10 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <div className="space-y-2">
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Processando pagamento…</h1>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Seu pagamento foi recebido. Estamos liberando o acesso Premium — costuma demorar até 1 minuto.
            </p>
          </div>
          <a
            href="/upgrade/sucesso"
            className="inline-block rounded-xl px-6 py-3 text-sm font-bold btn-accent"
          >
            Verificar agora
          </a>
          <p className="text-xs" style={{ color: 'var(--text-4)' }}>
            Se passar de 5 minutos sem confirmar, fale com a gente em <Link href="/faq" className="underline">suporte</Link>.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-md px-4 py-16 space-y-8">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--accent-text)' }}>
            Premium ativo
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Você está dentro.</h1>
          <p style={{ color: 'var(--text-2)' }}>
            Acesso em tempo real e alertas por Discord estão disponíveis agora.
          </p>
        </div>

        {/* Aviso de Discord não conectado */}
        {!hasDiscord && (
          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: 'rgba(88,101,242,0.1)', border: '1px solid rgba(88,101,242,0.3)' }}
          >
            <p className="text-sm font-semibold" style={{ color: '#a5b4fc' }}>
              Conecte seu Discord para receber o cargo premium
            </p>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              Sem isso, você não receberá o cargo no servidor nem as DMs de alerta.
            </p>
            <a
              href="/alerts"
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-all hover:opacity-90"
              style={{ background: 'var(--discord-color)' }}
            >
              <svg width="16" height="16" viewBox="0 0 127.14 96.36" fill="white">
                <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
              </svg>
              Conectar Discord agora
            </a>
          </div>
        )}

        <ul className="space-y-4 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
          {[
            { step: '1', title: 'Configure seus alertas', desc: 'Crie alertas por palavra-chave, categoria e tamanho.', href: '/alerts', cta: 'Ir para alertas' },
            { step: '2', title: 'Use filtros avançados', desc: 'Filtre por categoria e tamanho no feed em tempo real.', href: '/', cta: 'Ver feed' },
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
              <Link
                href={href}
                className="shrink-0 cursor-pointer rounded-lg px-3 py-1.5 text-xs font-medium transition-all hover:opacity-80"
                style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}
              >
                {cta}
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/"
          className="gradient-blue-bright ripple shine-effect block w-full cursor-pointer rounded-xl py-3.5 text-center font-semibold text-white transition-all hover:opacity-90"
        >
          Ver deals agora →
        </Link>
      </main>
    </div>
  );
}
