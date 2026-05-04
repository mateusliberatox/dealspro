export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { PortalButton } from '@/components/portal-button';
import { UpgradeButton } from '@/components/upgrade-button';

export default async function MinhaContaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('plan, discord_username, discord_avatar, stripe_customer_id, created_at')
    .eq('user_id', user.id)
    .single();

  const { count: alertCount } = await supabase
    .from('user_alerts_dealspro')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);

  const isPremium = profile?.plan === 'premium';
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-lg px-4 py-10 space-y-6">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Minha conta</h1>

        {/* Identity */}
        <section className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-4">
            {profile?.discord_avatar ? (
              <img
                src={profile.discord_avatar}
                alt="avatar"
                className="h-12 w-12 rounded-full"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/20 text-xl font-bold text-orange-400">
                {user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>
                {profile?.discord_username ?? user.email?.split('@')[0]}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-3)' }}>{user.email}</p>
            </div>
          </div>
          {memberSince && (
            <p className="text-xs" style={{ color: 'var(--text-4)' }}>Membro desde {memberSince}</p>
          )}
        </section>

        {/* Plan */}
        <section className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Plano</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-bold" style={{ color: 'var(--text)' }}>
                  {isPremium ? 'Premium' : 'Gratuito'}
                </span>
                {isPremium && (
                  <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
                    ATIVO
                  </span>
                )}
              </div>
            </div>
            {isPremium && profile?.stripe_customer_id ? (
              <PortalButton />
            ) : (
              <UpgradeButton className="px-4 py-2 text-sm" />
            )}
          </div>

          {isPremium && (
            <div className="rounded-xl bg-orange-500/5 border border-orange-500/20 px-4 py-3 space-y-1">
              {[
                '⚡ Acesso em tempo real (sem delay)',
                '🔔 Alertas por DM no Discord',
                '📐 Filtro por tamanho',
                '🏷️ Canal premium exclusivo',
              ].map((f) => (
                <p key={f} className="text-xs" style={{ color: 'var(--text-2)' }}>{f}</p>
              ))}
            </div>
          )}
        </section>

        {/* Alerts summary */}
        <section className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-3)' }}>Alertas ativos</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--text)' }}>
                {isPremium ? (alertCount ?? 0) : '—'}
              </p>
            </div>
            <Link
              href="/alerts"
              className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
            >
              {isPremium ? 'Gerenciar alertas' : 'Ver alertas'}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
