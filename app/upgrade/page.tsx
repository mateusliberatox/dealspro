export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { UpgradeButton } from '@/components/upgrade-button';

const FEATURES = [
  { icon: '⚡', title: 'Acesso em tempo real', desc: 'Veja os deals 30 minutos antes dos usuários free.' },
  { icon: '🔔', title: 'Alertas por DM no Discord', desc: 'Receba notificação quando aparecer o produto que você quer.' },
  { icon: '📐', title: 'Filtro por tamanho', desc: 'Encontre só o que cabe em você, sem filtrar manualmente.' },
  { icon: '🏷️', title: 'Canal premium exclusivo', desc: 'Notificações imediatas no Discord assim que um deal entra.' },
];

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
      <main className="mx-auto max-w-md px-4 py-12 space-y-8">

        {/* Headline */}
        <div className="text-center space-y-3">
          <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold text-orange-400" style={{ background: 'rgba(249,115,22,0.15)' }}>
            ⚡ Premium
          </span>
          <h1 className="text-3xl font-bold leading-tight" style={{ color: 'var(--text)' }}>
            Veja os deals antes<br />de todo mundo
          </h1>
          <p className="text-base" style={{ color: 'var(--text-3)' }}>
            Usuários free esperam 30 minutos. Com Premium, você vê na hora — e ainda recebe alertas no Discord.
          </p>
        </div>

        {/* Features */}
        <div className="rounded-2xl border divide-y overflow-hidden" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          {FEATURES.map(({ icon, title, desc }) => (
            <div key={title} className="flex items-start gap-3 px-5 py-4">
              <span className="text-xl shrink-0 mt-0.5">{icon}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-3)' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <UpgradeButton className="w-full py-4 text-base" />
          <div className="flex items-center justify-center gap-3 text-xs" style={{ color: 'var(--text-4)' }}>
            <span>💳 Stripe seguro</span>
            <span>·</span>
            <span>Cancele quando quiser</span>
            <span>·</span>
            <span>Sem contrato</span>
          </div>
        </div>

      </main>
    </div>
  );
}
