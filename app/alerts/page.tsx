export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Meus Alertas',
  description: 'Gerencie seus alertas de deals por palavra-chave, categoria e tamanho. Receba notificações por DM no Discord.',
};

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { AlertsUI } from '@/components/alerts-ui';
import { AlertMatches, matchProductsToAlerts } from '@/components/alert-matches';
import type { UserAlert, DealsproProfile, Produto } from '@/lib/types';

export default async function AlertsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date().toISOString();

  const [profileRes, alertsRes] = await Promise.all([
    supabase
      .from('dealspro_profiles')
      .select('plan, discord_user_id, discord_username')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('user_alerts_dealspro')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const profile   = profileRes.data as DealsproProfile | null;
  const alerts    = (alertsRes.data as UserAlert[]) ?? [];
  const isPremium = profile?.plan === 'premium';
  const hasActive = alerts.some((a) => a.is_active);

  // Fetch matching products only for premium users with active alerts
  let matchingProducts: Produto[] = [];
  if (isPremium && hasActive) {
    const { data: produtos } = await supabase
      .from('produtos_dealspro')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(300);

    matchingProducts = matchProductsToAlerts((produtos as Produto[]) ?? [], alerts);
  }

  return (
    <div className="min-h-screen">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-10">

        {/* Alerts management — centered, narrower */}
        <div className="mx-auto max-w-2xl space-y-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Meus Alertas</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
              Receba uma DM no Discord quando um produto com sua palavra-chave ou categoria aparecer.
            </p>
          </div>

          <AlertsUI
            profile={profile}
            alerts={alerts}
            userId={user.id}
          />
        </div>

        {/* Matching products — full width grid */}
        {isPremium && hasActive && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                Produtos encontrados
              </h2>
              {matchingProducts.length > 0 && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}
                >
                  {matchingProducts.length}
                </span>
              )}
            </div>
            <p className="text-sm" style={{ color: 'var(--text-3)' }}>
              Produtos no catálogo que correspondem aos seus alertas ativos.
            </p>

            <AlertMatches matches={matchingProducts} />
          </div>
        )}

      </main>
    </div>
  );
}
