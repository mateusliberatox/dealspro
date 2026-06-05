export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { AlertsUI } from '@/components/alerts-ui';
import { AlertMatches, matchProductsToAlerts } from '@/components/alert-matches';
import { TestDmButton } from '@/components/test-dm-button';
import type { UserAlert, DealsproProfile, Produto } from '@/lib/types';

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { title: 'Meus Alertas', description: 'Gerencie seus alertas de deals.' };

  const { count } = await supabase
    .from('user_alerts_dealspro')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);

  const n = count ?? 0;
  return {
    title:       n > 0 ? `${n} alerta${n > 1 ? 's' : ''} ativo${n > 1 ? 's' : ''}` : 'Meus Alertas',
    description: 'Gerencie seus alertas de deals. Receba notificações por Discord e Telegram.',
  };
}

export default async function AlertsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const now = new Date().toISOString();

  const [profileRes, alertsRes] = await Promise.all([
    supabase
      .from('dealspro_profiles')
      .select('plan, discord_user_id, discord_username, telegram_chat_id, telegram_username, referral_code')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('user_alerts_dealspro')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const profile    = profileRes.data as DealsproProfile | null;
  const alerts     = (alertsRes.data as UserAlert[]) ?? [];
  const isPremium  = profile?.plan === 'premium';
  const hasActive  = alerts.some((a) => a.is_active);
  const hasDiscord = !!profile?.discord_user_id;
  const hasTelegram = !!profile?.telegram_chat_id;
  const telegramBot = process.env.TELEGRAM_BOT_USERNAME ?? '';

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
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">

        {/* Cabeçalho */}
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>Meus Alertas</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
            Receba uma DM quando um produto com sua palavra-chave ou categoria aparecer.
          </p>
        </div>

        {/* Conexões — só para premium */}
        {isPremium && (
          <div className="rounded-2xl border p-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>
              Canais de notificação
            </p>
            <div className="grid grid-cols-2 gap-3">

              {/* Discord */}
              <div
                className="flex flex-col rounded-xl p-3"
                style={{
                  background:  hasDiscord ? 'rgba(88,101,242,0.08)' : 'var(--surface-2)',
                  border:      `1px solid ${hasDiscord ? 'rgba(88,101,242,0.25)' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <svg width="20" height="15" viewBox="0 0 127.14 96.36" fill={hasDiscord ? 'var(--discord-color)' : 'var(--text-4)'} aria-hidden>
                    <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                  </svg>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Discord</p>
                    {hasDiscord ? (
                      <p className="text-[11px] text-green-500 truncate">✓ {profile?.discord_username}</p>
                    ) : (
                      <Link href="/minha-conta" className="text-[11px] hover:underline" style={{ color: 'var(--accent-text)' }}>
                        Vincular →
                      </Link>
                    )}
                  </div>
                </div>
                {hasDiscord && <TestDmButton channel="discord" />}
              </div>

              {/* Telegram */}
              <div
                className="flex flex-col rounded-xl p-3"
                style={{
                  background:  hasTelegram ? 'rgba(34,158,217,0.08)' : 'var(--surface-2)',
                  border:      `1px solid ${hasTelegram ? 'rgba(34,158,217,0.25)' : 'var(--border)'}`,
                }}
              >
                <div className="flex items-center gap-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill={hasTelegram ? 'var(--telegram-color)' : 'var(--text-4)'} aria-hidden>
                    <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.16 13.67l-2.965-.924c-.644-.204-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.993.889z"/>
                  </svg>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>Telegram</p>
                    {hasTelegram ? (
                      <p className="text-[11px] text-green-500 truncate">✓ @{profile?.telegram_username}</p>
                    ) : telegramBot ? (
                      <a
                        href={`https://t.me/${telegramBot}?start=${profile?.referral_code ?? ''}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] hover:underline"
                        style={{ color: 'var(--accent-text)' }}
                      >
                        Vincular →
                      </a>
                    ) : (
                      <p className="text-[11px]" style={{ color: 'var(--text-4)' }}>Não configurado</p>
                    )}
                  </div>
                </div>
                {hasTelegram && <TestDmButton channel="telegram" />}
              </div>

            </div>
            {!hasDiscord && !hasTelegram && (
              <p className="mt-3 text-xs text-center" style={{ color: 'var(--text-3)' }}>
                Vincule ao menos um canal para receber alertas por DM.
              </p>
            )}
          </div>
        )}

        {/* Gerenciamento de alertas */}
        <AlertsUI
          profile={profile}
          alerts={alerts}
          userId={user.id}
        />

        {/* Produtos encontrados */}
        {isPremium && hasActive && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="flex items-baseline gap-3">
              <h2 className="text-lg font-bold" style={{ color: 'var(--text)' }}>Produtos encontrados</h2>
              {matchingProducts.length > 0 && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                  style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}
                >
                  {matchingProducts.length}
                </span>
              )}
            </div>
            <AlertMatches matches={matchingProducts} />
          </div>
        )}

      </main>
    </div>
  );
}
