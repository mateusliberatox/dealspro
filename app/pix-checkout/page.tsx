export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: 'Pagar com PIX — DealsPro',
};

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Header } from '@/components/header';
import { PixQRDisplay } from '@/components/pix-qr-display';

export default async function PixCheckoutPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  if (profile?.plan === 'premium') redirect('/');

  return (
    <div className="min-h-screen">
      <Header />
      <main className="mx-auto max-w-md px-4 py-14">
        <PixQRDisplay />
      </main>
    </div>
  );
}
