import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// Endpoint de diagnóstico — requer login de admin
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();
  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

  const token = process.env.DISCORD_BOT_TOKEN;

  // 1. Token ausente
  if (!token) {
    return NextResponse.json({
      ok: false,
      issue: 'DISCORD_BOT_TOKEN não está definido nas env vars da Vercel.',
      fix: 'Adicione a variável e faça Redeploy.',
    });
  }

  // 2. Token com prefixo "Bot " incluído por engano
  if (token.startsWith('Bot ')) {
    return NextResponse.json({
      ok: false,
      issue: 'Token contém o prefixo "Bot " — esse prefixo não deve fazer parte do valor.',
      fix: 'Na Vercel, remova "Bot " do começo do valor e salve só o token puro.',
      tokenPreview: `${token.slice(0, 8)}...`,
    });
  }

  // 3. Valida o token contra a API do Discord
  const res  = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bot ${token}` },
  });
  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({
      ok: false,
      issue: `Token inválido ou expirado (Discord retornou ${res.status}).`,
      discordError: data,
      fix: 'Vá ao Developer Portal → Bot → Reset Token → copie o novo token → atualize na Vercel → Redeploy.',
      tokenLength: token.length,
      tokenPreview: `${token.slice(0, 8)}...`,
    });
  }

  return NextResponse.json({
    ok: true,
    bot: { username: data.username, id: data.id },
    message: 'Token válido. Se o teste de DM ainda falha, o problema é outro.',
  });
}
