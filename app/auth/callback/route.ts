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

  // If the user logged in with Discord, save their Discord identity to their profile
  const discord = data.user.identities?.find((i) => i.provider === 'discord');
  if (discord) {
    const discordUserId  = discord.identity_data?.provider_id ?? discord.id;
    const discordUsername = discord.identity_data?.full_name
      ?? discord.identity_data?.name
      ?? discord.identity_data?.preferred_username
      ?? null;
    const discordAvatar  = discord.identity_data?.avatar_url ?? null;

    await supabase
      .from('dealspro_profiles')
      .update({ discord_user_id: discordUserId, discord_username: discordUsername, discord_avatar: discordAvatar })
      .eq('user_id', data.user.id);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
