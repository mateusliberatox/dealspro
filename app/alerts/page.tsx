export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { AlertsUI } from '@/components/alerts-ui';
import type { UserAlert, DealsproProfile } from '@/lib/types';

export default async function AlertsPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('plan, discord_user_id, discord_username')
    .eq('user_id', user.id)
    .single();

  const { data: alerts } = await supabase
    .from('user_alerts')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-8 space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Meus Alertas</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Receba uma DM no Discord quando um produto com sua palavra-chave aparecer.
          </p>
        </div>

        <AlertsUI
          profile={profile as DealsproProfile}
          alerts={(alerts as UserAlert[]) ?? []}
          userId={user.id}
        />
      </main>
    </div>
  );
}
