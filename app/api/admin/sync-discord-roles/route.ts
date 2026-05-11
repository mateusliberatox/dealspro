import { createClient } from '@supabase/supabase-js';
import { addPremiumRole, removePremiumRole } from '@/lib/discord';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  return NextResponse.json({ synced: results.length, results });
}
