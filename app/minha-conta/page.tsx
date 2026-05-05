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
      <main className="mx-auto max-w-lg px-4 py-10 space-y-5">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text)' }}>Minha conta</h1>

        {/* Identidade */}
        <section className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-4">
            {profile?.discord_avatar ? (
              <img src={profile.discord_avatar} alt="avatar" className="h-11 w-11 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full text-base font-bold text-white"
                style={{ background: 'var(--accent)' }}
              >
                {user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p className="font-semibold" style={{ color: 'var(--text)' }}>
                {profile?.discord_username ?? user.email?.split('@')[0]}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-2)' }}>{user.email}</p>
            </div>
          </div>
          {memberSince && (
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>Membro desde {memberSince}</p>
          )}
        </section>

        {/* Plano */}
        <section className="rounded-xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Plano</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-base font-bold" style={{ color: 'var(--text)' }}>
                  {isPremium ? 'Premium' : 'Gratuito'}
                </span>
                {isPremium && (
                  <span
                    className="rounded px-2 py-0.5 text-[10px] font-semibold"
                    style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}
                  >
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
            <ul className="space-y-1 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
              {[
                'Acesso em tempo real (sem delay)',
                'Alertas por DM no Discord',
                'Filtros por tamanho',
                'Canal premium exclusivo',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
                  <span style={{ color: 'var(--accent-text)' }}>✓</span> {f}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Alertas */}
        <section className="rounded-xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Alertas ativos</p>
              <p className="mt-1 text-2xl font-bold" style={{ color: 'var(--text)' }}>
                {isPremium ? (alertCount ?? 0) : '—'}
              </p>
            </div>
            <Link
              href="/alerts"
              className="btn-accent rounded-lg px-4 py-2 text-sm font-semibold"
            >
              {isPremium ? 'Gerenciar alertas' : 'Ver alertas'}
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
