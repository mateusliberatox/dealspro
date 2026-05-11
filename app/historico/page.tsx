import type { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { Feed } from '@/components/feed';
import type { Produto } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Histórico de Deals',
  description: 'Veja todos os deals detectados pelo DealsPro nos últimos 30 dias.',
};

export default async function HistoricoPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: { user } } = await supabase.auth.getUser();

  let plan: 'free' | 'premium' = 'free';
  if (user) {
    const { data: profile } = await supabase
      .from('dealspro_profiles')
      .select('plan')
      .eq('user_id', user.id)
      .single();
    plan = profile?.plan ?? 'free';
  }

  const isPremium = plan === 'premium';

  let q = supabase
    .from('produtos_dealspro')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(500);

  if (!isPremium) q = q.lte('visible_at', now);

  const { data } = await q;
  const produtos = (data as Produto[]) ?? [];

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-6xl px-4 pb-16">
        <div className="mb-6 mt-8 animate-fade-in-up">
          <h1 className="text-lg font-bold" style={{ color: 'var(--text)' }}>
            Histórico de Deals
          </h1>
          <p className="mt-0.5 text-sm" style={{ color: 'var(--text-2)' }}>
            {produtos.length} produto{produtos.length !== 1 ? 's' : ''} detectados · últimos 30 dias
          </p>
        </div>
        <Feed produtos={produtos} isPremium={isPremium} />
      </main>
    </div>
  );
}
