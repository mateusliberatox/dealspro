export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { UpgradeButton } from '@/components/upgrade-button';

export default async function UpgradePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  if (profile?.plan === 'premium') redirect('/');

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-16 text-center space-y-8">
        <div>
          <span className="rounded-full bg-orange-500/20 px-4 py-1.5 text-sm font-semibold text-orange-400">
            Premium
          </span>
          <h1 className="mt-4 text-3xl font-bold" style={{ color: 'var(--text)' }}>
            Veja os produtos antes de todo mundo
          </h1>
          <p className="mt-3 text-base" style={{ color: 'var(--text-3)' }}>
            Usuários free esperam 30 minutos. Premium vê em tempo real — no site e no Discord.
          </p>
        </div>

        {/* Feature list */}
        <div className="rounded-2xl border p-6 text-left space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {[
            ['⚡', 'Acesso em tempo real (sem delay de 30 min)'],
            ['🔔', 'Alertas por DM no Discord por palavra-chave'],
            ['📐', 'Filtro por tamanho nos alertas'],
            ['🏷️', 'Notificação imediata no canal premium'],
          ].map(([icon, text]) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-xl">{icon}</span>
              <span className="text-sm" style={{ color: 'var(--text-2)' }}>{text}</span>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <UpgradeButton className="w-full py-4 text-base" />
          <p className="text-xs" style={{ color: 'var(--text-4)' }}>
            Cobrança via Stripe · Cancele quando quiser
          </p>
        </div>
      </main>
    </div>
  );
}
