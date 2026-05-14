import { createClient } from '@/lib/supabase/server';
import { createClient as createAdmin } from '@supabase/supabase-js';
import { addPremiumRole } from '@/lib/discord';
import { NextRequest, NextResponse } from 'next/server';

function getAdmin() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

async function syncDiscordByUserId(userId: string) {
  const admin = getAdmin();

  // Busca dados frescos do banco — independente de qual JWT está em memória
  const { data: { user }, error } = await admin.auth.admin.getUserById(userId);
  if (error || !user) return;

  const discord = user.identities?.find((i) => i.provider === 'discord');
  if (!discord) return;

  const profileUpdate = {
    user_id:          userId,
    discord_user_id:  (discord.identity_data?.provider_id ?? discord.identity_data?.sub ?? null) as string | null,
    discord_username: (discord.identity_data?.full_name
      ?? discord.identity_data?.name
      ?? discord.identity_data?.preferred_username
      ?? null) as string | null,
    discord_avatar:   (discord.identity_data?.avatar_url ?? null) as string | null,
  };

  await admin
    .from('dealspro_profiles')
    .upsert(profileUpdate, { onConflict: 'user_id' });

  if (profileUpdate.discord_user_id) {
    const { data: profile } = await admin
      .from('dealspro_profiles')
      .select('plan')
      .eq('user_id', userId)
      .single();
    if (profile?.plan === 'premium') {
      await addPremiumRole(profileUpdate.discord_user_id);
    }
  }
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  const supabase = await createClient();

  // Lê código de indicação do cookie (salvo pela rota /r/[code])
  const refCode = request.cookies.get('dp_ref')?.value ?? null;

  if (!code) {
    // Retorno do linkIdentity: sessão já existe, sem código PKCE
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await syncDiscordByUserId(user.id);
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  await syncDiscordByUserId(data.user.id);

  // Salva código de indicação se for um novo cadastro
  if (refCode) {
    const admin = getAdmin();
    const { data: profile } = await admin
      .from('dealspro_profiles')
      .select('referred_by')
      .eq('user_id', data.user.id)
      .single();

    // Só salva se ainda não tiver indicação (evita sobrescrever)
    if (profile && !profile.referred_by) {
      // Verifica se o código pertence a outro usuário (não a si mesmo)
      const { data: referrer } = await admin
        .from('dealspro_profiles')
        .select('user_id')
        .eq('referral_code', refCode)
        .neq('user_id', data.user.id)
        .single();

      if (referrer) {
        await admin
          .from('dealspro_profiles')
          .update({ referred_by: refCode })
          .eq('user_id', data.user.id);
      }
    }
  }

  // Limpa cookie de indicação após uso
  const redirectResponse = NextResponse.redirect(`${origin}${next}`);
  if (refCode) redirectResponse.cookies.delete('dp_ref');
  return redirectResponse;
}
