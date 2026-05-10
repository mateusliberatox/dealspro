import { createClient } from '@/lib/supabase/server';
import { addPremiumRole } from '@/lib/discord';
import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

async function syncDiscordIdentity(supabase: SupabaseClient, user: { id: string; identities?: { provider: string; identity_data?: Record<string, unknown> }[] }) {
  const discord = user.identities?.find((i) => i.provider === 'discord');
  if (!discord) return;

  const profileUpdate: Record<string, unknown> = {
    user_id:          user.id,
    discord_user_id:  discord.identity_data?.provider_id ?? null,
    discord_username: discord.identity_data?.full_name
      ?? discord.identity_data?.name
      ?? discord.identity_data?.preferred_username
      ?? null,
    discord_avatar:   discord.identity_data?.avatar_url ?? null,
  };

  await supabase.from('dealspro_profiles').upsert(profileUpdate, { onConflict: 'user_id' });

  if (profileUpdate.discord_user_id) {
    const { data: profile } = await supabase
      .from('dealspro_profiles')
      .select('plan')
      .eq('user_id', user.id)
      .single();
    if (profile?.plan === 'premium') {
      await addPremiumRole(profileUpdate.discord_user_id as string).catch(() => {});
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  const supabase = await createClient();

  // Sem código: pode ser retorno do linkIdentity (sessão já existe no cookie)
  if (!code) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      // Sessão ativa — sincroniza identidades Discord caso linkIdentity tenha vinculado
      await syncDiscordIdentity(supabase, user);
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  await syncDiscordIdentity(supabase, data.user as Parameters<typeof syncDiscordIdentity>[1]);

  return NextResponse.redirect(`${origin}${next}`);
}
