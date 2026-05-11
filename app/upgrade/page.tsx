export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Assinar Premium',
  description: 'Veja os deals do CSSDeals em tempo real, sem delay, com alertas por DM no Discord. A partir de R$ 7,99/mês.',
};

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { UpgradeButton } from '@/components/upgrade-button';
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe';
import { createClient as createAdmin } from '@supabase/supabase-js';

const COMPARE = [
  { feature: 'Feed de deals',                free: true,  premium: true  },
  { feature: 'Filtros por categoria',        free: true,  premium: true  },
  { feature: 'Acesso sem delay',             free: false, premium: true  },
  { feature: 'Canal exclusivo no Discord',   free: false, premium: true  },
  { feature: 'Alertas por DM no Discord',    free: false, premium: true  },
  { feature: 'Filtro por palavra-chave',     free: false, premium: true  },
  { feature: 'Filtro por tamanho',           free: false, premium: true  },
  { feature: 'Histórico completo de deals',  free: false, premium: true  },
];

async function getPriceDisplay(): Promise<string | null> {
  try {
    const price    = await stripe.prices.retrieve(STRIPE_PRICE_ID);
    if (!price.unit_amount) return null;
    const amount   = (price.unit_amount / 100).toFixed(2).replace('.', ',');
    const currency = price.currency === 'brl' ? 'R$' : price.currency.toUpperCase();
    const interval = price.recurring?.interval === 'month' ? '/mês'
                   : price.recurring?.interval === 'year'  ? '/ano' : '';
    return `${currency} ${amount}${interval}`;
  } catch { return null; }
}

async function getPremiumCount(): Promise<number> {
  const admin = createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { count } = await admin
    .from('dealspro_profiles')
    .select('*', { count: 'exact', head: true })
    .eq('plan', 'premium');
  return count ?? 0;
}

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

  const [priceDisplay, premiumCount] = await Promise.all([
    getPriceDisplay(),
    getPremiumCount(),
  ]);

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-14 space-y-12">

        {/* Hero */}
        <div className="text-center space-y-4 animate-fade-in-up">
          <span
            className="inline-block rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
            style={{ background: 'var(--accent-dim)', color: 'var(--accent-text)' }}
          >
            Premium
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-[1.15] tracking-tight" style={{ color: 'var(--text)' }}>
            Veja os deals<br />
            <span className="gradient-blue-text">antes que esgotem</span>
          </h1>
          <p className="text-base max-w-md mx-auto" style={{ color: 'var(--text-2)' }}>
            Enquanto usuários free esperam 30 minutos, você recebe na hora — no site e direto no Discord.
          </p>
          {premiumCount > 0 && (
            <p className="text-sm font-medium" style={{ color: 'var(--text-3)' }}>
              🔥 {premiumCount} {premiumCount === 1 ? 'membro' : 'membros'} já com acesso Premium
            </p>
          )}
        </div>

        {/* Comparativo */}
        <div className="glass rounded-2xl overflow-hidden animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          {/* Header */}
          <div className="grid grid-cols-3 px-5 py-3 text-xs font-bold uppercase tracking-widest" style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', color: 'var(--text-3)' }}>
            <span>Recurso</span>
            <span className="text-center">Free</span>
            <span className="text-center gradient-blue-text">Premium</span>
          </div>

          {COMPARE.map(({ feature, free, premium }, i) => (
            <div
              key={feature}
              className="grid grid-cols-3 items-center px-5 py-3.5 text-sm"
              style={{
                borderBottom: i < COMPARE.length - 1 ? '1px solid var(--border)' : 'none',
                background:   i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
              }}
            >
              <span style={{ color: 'var(--text-2)' }}>{feature}</span>
              <span className="text-center text-base">{free ? '✓' : <span style={{ color: 'var(--text-4)' }}>—</span>}</span>
              <span className="text-center text-base" style={{ color: premium ? '#22c55e' : 'var(--text-4)' }}>
                {premium ? '✓' : '—'}
              </span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="glass rounded-2xl p-7 text-center space-y-5 animate-fade-in-up" style={{ animationDelay: '0.2s', border: '1px solid rgba(59,130,246,0.3)' }}>
          {priceDisplay && (
            <div>
              <p className="text-4xl font-extrabold tracking-tight gradient-blue-text">{priceDisplay}</p>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>Cancele quando quiser. Sem contrato.</p>
            </div>
          )}

          <UpgradeButton className="w-full py-4 text-base" />

          <div className="flex items-center justify-center gap-6 text-xs" style={{ color: 'var(--text-3)' }}>
            <span>🔒 Pagamento seguro via Stripe</span>
            <span>↩️ Cancele a qualquer momento</span>
          </div>

          <p className="text-xs" style={{ color: 'var(--text-4)' }}>
            Prefere assinar pelo Discord? Use o comando <span className="font-mono" style={{ color: 'var(--accent-text)' }}>/assinar</span> no servidor.
          </p>
          <a href="/faq" className="text-xs underline-offset-2 hover:underline" style={{ color: 'var(--text-4)' }}>
            Tem dúvidas? Veja o FAQ →
          </a>
        </div>

      </main>
    </div>
  );
}
