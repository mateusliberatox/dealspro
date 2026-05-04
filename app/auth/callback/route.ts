import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  const userId = data.user.id;

  // Ensure profile exists (handles existing users whose profile wasn't created by trigger)
  const profileUpdate: Record<string, unknown> = { user_id: userId };

  // If logged in with Discord, save identity data
  const discord = data.user.identities?.find((i) => i.provider === 'discord');
  if (discord) {
    profileUpdate.discord_user_id  = discord.identity_data?.provider_id ?? discord.id;
    profileUpdate.discord_username = discord.identity_data?.full_name
      ?? discord.identity_data?.name
      ?? discord.identity_data?.preferred_username
      ?? null;
    profileUpdate.discord_avatar   = discord.identity_data?.avatar_url ?? null;
  }

  // upsert: creates profile if missing, updates discord fields if present
  await supabase
    .from('dealspro_profiles')
    .upsert(profileUpdate, { onConflict: 'user_id' });

  return NextResponse.redirect(`${origin}${next}`);
}
