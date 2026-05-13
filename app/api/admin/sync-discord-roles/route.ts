import { createClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { addPremiumRole, removePremiumRole } from '@/lib/discord';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  const cronOk = secret === process.env.CRON_SECRET;

  // Aceita: CRON_SECRET válido OU sessão de usuário admin
  if (!cronOk) {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('dealspro_profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: users } = await supabase
    .from('dealspro_profiles')
    .select('discord_user_id, discord_username, plan')
    .not('discord_user_id', 'is', null);

  if (!users?.length) return NextResponse.json({ synced: 0 });

  const results: { username: string; action: string; ok: boolean }[] = [];
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  for (const u of users) {
    const isPremium = u.plan === 'premium';
    try {
      if (isPremium) await addPremiumRole(u.discord_user_id);
      else           await removePremiumRole(u.discord_user_id);
      results.push({ username: u.discord_username, action: isPremium ? 'add' : 'remove', ok: true });
    } catch {
      results.push({ username: u.discord_username, action: isPremium ? 'add' : 'remove', ok: false });
    }
    await sleep(600); // evita rate limit da Discord API (5 req/s por guild)
  }

  console.log(JSON.stringify({
    audit:  'sync_discord_roles',
    synced: results.length,
    via:    cronOk ? 'cron_secret' : 'admin_session',
    at:     new Date().toISOString(),
  }));

  return NextResponse.json({ synced: results.length, results });
}
