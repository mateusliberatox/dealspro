export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { OrdersPanel } from '@/components/orders-panel';
import { STATUS_LABELS, STATUS_EMOJI } from '@/lib/tracking';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pedidos · DealsPro',
  description: 'Rastreamento de encomendas internacionais.',
};

export type OrderRow = {
  id:             string;
  tracking_code:  string;
  description:    string | null;
  status:         string;
  last_event:     string | null;
  last_event_at:  string | null;
  carrier_code:   number | null;
  created_at:     string;
};

export default async function PedidosPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ data: orders }, { data: profile }] = await Promise.all([
    supabase
      .from('user_orders')
      .select('id, tracking_code, description, status, last_event, last_event_at, carrier_code, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('dealspro_profiles')
      .select('plan')
      .eq('user_id', user.id)
      .single(),
  ]);

  const isPremium = profile?.plan === 'premium';
  const limit     = isPremium ? 20 : 3;

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-10">

        <div className="mb-8 animate-fade-in-up">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            📦 Minhas Encomendas
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-3)' }}>
            Rastreamento automático via Discord e Telegram.{' '}
            <span style={{ color: 'var(--text-2)' }}>{orders?.length ?? 0}/{limit} slots usados</span>
          </p>
        </div>

        <OrdersPanel
          initialOrders={(orders ?? []) as OrderRow[]}
          isPremium={isPremium}
          limit={limit}
          statusLabels={STATUS_LABELS}
          statusEmoji={STATUS_EMOJI}
        />

        {!isPremium && (
          <div
            className="mt-8 rounded-xl p-4 text-sm animate-fade-in-up"
            style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent-dim)' }}
          >
            <p style={{ color: 'var(--accent-text)' }}>
              ★ <strong>Premium</strong> — rastreie até 20 encomendas e receba alertas instantâneos
              por Discord e Telegram quando o status mudar.{' '}
              <a href="/upgrade" style={{ color: 'var(--accent-text)', textDecoration: 'underline' }}>
                Assinar
              </a>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
