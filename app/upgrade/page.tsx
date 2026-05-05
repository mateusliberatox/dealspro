export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { UpgradeButton } from '@/components/upgrade-button';
import { stripe, STRIPE_PRICE_ID } from '@/lib/stripe';

const FEATURES = [
  { title: 'Sem delay de 30 minutos', desc: 'Você vê o produto assim que ele é detectado. Free espera.' },
  { title: 'Alerta por DM no Discord', desc: 'Palavra-chave + tamanho. Você recebe quando aparece.' },
  { title: 'Canal exclusivo no Discord', desc: 'Notificação imediata. Sem precisar abrir o site.' },
  { title: 'Filtro por tamanho', desc: 'Não perde tempo olhando o que não tem no seu tamanho.' },
];

async function getPriceDisplay(): Promise<string | null> {
  try {
    const price  = await stripe.prices.retrieve(STRIPE_PRICE_ID);
    if (!price.unit_amount) return null;
    const amount   = (price.unit_amount / 100).toFixed(2).replace('.', ',');
    const currency = price.currency === 'brl' ? 'R$' : price.currency.toUpperCase();
    const interval = price.recurring?.interval === 'month' ? '/mês'
                   : price.recurring?.interval === 'year'  ? '/ano' : '';
    return `${currency} ${amount}${interval}`;
  } catch { return null; }
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

  const priceDisplay = await getPriceDisplay();

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-sm px-4 py-14 space-y-10">

        {/* Headline */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--accent)' }}>
            Premium
          </p>
          <h1 className="text-[1.75rem] font-bold leading-[1.2] tracking-tight" style={{ color: 'var(--text)' }}>
            Veja os deals antes que esgotem.
          </h1>
          <p className="text-[0.9375rem]" style={{ color: 'var(--text-2)' }}>
            Free users esperam 30 minutos. Premium recebe na hora, no site e no Discord.
          </p>
        </div>

        {/* Features — lista limpa, sem box */}
        <ul className="space-y-5">
          {FEATURES.map(({ title, desc }) => (
            <li key={title} className="flex gap-3">
              <span className="mt-0.5 h-4 w-4 shrink-0 rounded-full bg-orange-500/20 text-center text-[10px] font-bold leading-4 text-orange-400">
                ✓
              </span>
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>{desc}</p>
              </div>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <div className="space-y-3">
          {priceDisplay && (
            <p className="text-[2rem] font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              {priceDisplay}
            </p>
          )}
          <UpgradeButton className="w-full py-3.5 text-[0.9375rem]" />
          <p className="text-xs text-center" style={{ color: 'var(--text-3)' }}>
            Cancele quando quiser. Sem contrato.
          </p>
        </div>

      </main>
    </div>
  );
}
