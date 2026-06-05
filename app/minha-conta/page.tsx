export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { PortalButton } from '@/components/portal-button';
import { ReferralCopy } from '@/components/referral-copy';
import { UpgradeButton } from '@/components/upgrade-button';
import { DiscordConnectButton } from '@/components/discord-connect-button';
import { TelegramConnectButton } from '@/components/telegram-connect-button';

export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { title: 'Minha Conta', description: 'Gerencie sua conta, plano e conexões.' };

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  const isPremium = profile?.plan === 'premium';
  return {
    title:       isPremium ? '★ Premium · Minha Conta' : 'Minha Conta',
    description: 'Gerencie sua conta, plano e conexões no DealsPro.',
  };
}

export default async function MinhaContaPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('plan, discord_user_id, discord_username, discord_avatar, stripe_customer_id, created_at, referral_code, telegram_chat_id, telegram_username, telegram_notify_mode')
    .eq('user_id', user.id)
    .single();

  const [{ count: alertCount }, { count: clickCount }, { count: dmCount }] = await Promise.all([
    supabase.from('user_alerts_dealspro').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_active', true),
    supabase.from('click_logs').select('*', { count: 'exact', head: true }).eq('user_id', user.id),
    supabase.from('notification_logs').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'sent'),
  ]);

  const isPremium   = profile?.plan === 'premium';
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    : null;
  const telegramBotUsername = process.env.TELEGRAM_BOT_USERNAME ?? '';
  const hasDiscord  = !!profile?.discord_user_id;
  const hasTelegram = !!profile?.telegram_chat_id;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-5">

        {/* ── Identidade ── */}
        <section
          className="rounded-2xl border p-5"
          style={{
            background:  'var(--surface)',
            borderColor: isPremium ? 'rgba(59,130,246,0.3)' : 'var(--border)',
          }}
        >
          <div className="flex items-center gap-4">
            {profile?.discord_avatar ? (
              <Image src={profile.discord_avatar} alt={`Avatar de ${profile.discord_username ?? user.email}`} width={56} height={56} className="h-14 w-14 rounded-full shrink-0" referrerPolicy="no-referrer" />
            ) : (
              <div
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
                style={{ background: 'var(--accent)' }}
              >
                {user.email?.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-base" style={{ color: 'var(--text)' }}>
                  {profile?.discord_username ?? user.email?.split('@')[0]}
                </p>
                {isPremium && (
                  <span
                    className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                    style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}
                  >
                    ★ Premium
                  </span>
                )}
              </div>
              <p className="text-sm truncate" style={{ color: 'var(--text-3)' }}>{user.email}</p>
              {memberSince && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-4)' }}>Membro desde {memberSince}</p>
              )}
            </div>
          </div>
        </section>

        {/* ── Grid principal ── */}
        <div className="grid gap-5 sm:grid-cols-2">

          {/* Plano */}
          <section className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Plano atual</p>
                <p className="mt-1 text-xl font-bold" style={{ color: 'var(--text)' }}>
                  {isPremium ? 'Premium' : 'Gratuito'}
                </p>
              </div>
              {isPremium && profile?.stripe_customer_id ? (
                <PortalButton />
              ) : (
                <UpgradeButton className="px-3 py-1.5 text-xs" />
              )}
            </div>

            {isPremium ? (
              <ul className="space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                {[
                  'Deals 30 min antes dos usuários gratuitos',
                  'Alertas por DM no Discord e Telegram',
                  'Canal exclusivo com curadoria premium',
                  'Filtros por keyword, categoria e tamanho',
                  'Notificação de restock automática',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-2)' }}>
                    <span style={{ color: 'var(--accent-text)' }}>✓</span> {f}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-1.5 border-t pt-3" style={{ borderColor: 'var(--border)' }}>
                {[
                  'Deals 30 min antes de todo mundo',
                  'Alertas por DM no Discord e Telegram',
                  'Canal exclusivo com curadoria premium',
                  'Filtros por keyword, categoria e tamanho',
                  'Notificação de restock automática',
                ].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-3)' }}>
                    <span style={{ color: 'var(--border)' }}>○</span> {f}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Conexões */}
          <section className="rounded-2xl border p-5 space-y-4" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Conexões</p>

            {/* Discord */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <svg width="18" height="14" viewBox="0 0 127.14 96.36" fill="var(--discord-color)" aria-hidden>
                  <path d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21h0A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22h0C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.44-12.74S96.23,46,96.12,53,91.08,65.69,84.69,65.69Z"/>
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Discord</p>
                  {hasDiscord && <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>{profile?.discord_username}</p>}
                </div>
              </div>
              {hasDiscord ? (
                <span className="shrink-0 text-xs font-semibold text-green-500">✓ Vinculado</span>
              ) : (
                <DiscordConnectButton connected={false} />
              )}
            </div>

            <div className="h-px" style={{ background: 'var(--border)' }} />

            {/* Telegram */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="var(--telegram-color)" aria-hidden>
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.16 13.67l-2.965-.924c-.644-.204-.657-.644.136-.953l11.57-4.461c.537-.194 1.006.131.993.889z"/>
                </svg>
                <div className="min-w-0">
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>Telegram</p>
                  {hasTelegram && <p className="text-xs truncate" style={{ color: 'var(--text-3)' }}>@{profile?.telegram_username}</p>}
                </div>
              </div>
              {hasTelegram ? (
                <span className="shrink-0 text-xs font-semibold text-green-500">✓ Vinculado</span>
              ) : telegramBotUsername ? (
                <a
                  href={`https://t.me/${telegramBotUsername}?start=${profile?.referral_code ?? ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: 'var(--telegram-color)' }}
                >
                  Vincular
                </a>
              ) : null}
            </div>

          </section>
        </div>

        {/* ── Atividade ── */}
        <section className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="mb-4 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Sua atividade</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Deals acessados', value: clickCount ?? 0, accent: false },
              { label: 'Alertas ativos',  value: isPremium ? (alertCount ?? 0) : '—', accent: false },
              { label: 'DMs recebidas',   value: isPremium ? (dmCount ?? 0) : '—', accent: isPremium },
            ].map(({ label, value, accent }) => (
              <div key={label} className="rounded-xl p-3 text-center" style={{ background: 'var(--surface-2)' }}>
                <p className="text-2xl font-bold" style={{ color: accent ? 'var(--accent-text)' : 'var(--text)' }}>{value}</p>
                <p className="mt-0.5 text-[11px] leading-tight" style={{ color: 'var(--text-3)' }}>{label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Link href="/alerts" className="text-xs font-medium hover:underline underline-offset-2" style={{ color: 'var(--accent-text)' }}>
              {isPremium ? 'Gerenciar alertas →' : 'Ver alertas →'}
            </Link>
          </div>
        </section>

        {/* ── Indicação ── */}
        {profile?.referral_code && (
          <section className="rounded-2xl border p-5 space-y-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-3)' }}>Indicar amigos</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-2)' }}>
                  Compartilhe seu link e ganhe <span className="font-semibold" style={{ color: 'var(--accent-text)' }}>1 mês grátis</span> quando o indicado assinar o Premium.
                </p>
              </div>
            </div>
            <ReferralCopy code={profile.referral_code} />
          </section>
        )}

      </main>
    </div>
  );
}
