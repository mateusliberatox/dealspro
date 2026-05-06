import { createClient } from '@/lib/supabase/server';
import { sendBotDM } from '@/lib/discord';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('plan, discord_user_id')
    .eq('user_id', user.id)
    .single();

  if (profile?.plan !== 'premium') {
    return NextResponse.json({ error: 'Recurso Premium' }, { status: 403 });
  }

  if (!profile?.discord_user_id) {
    return NextResponse.json({ error: 'Conta Discord não conectada. Conecte em Alertas.' }, { status: 400 });
  }

  try {
    await sendBotDM(profile.discord_user_id, {
      content: '🔔 **Teste de alerta — DealsPro**',
      embeds: [
        {
          color: 0x032890,
          title: 'Sistema de notificações funcionando!',
          description:
            'Seus alertas estão ativos. Quando um produto com sua palavra-chave aparecer no CSSDeals, você receberá uma mensagem como esta — com imagem, preço e link direto.',
          fields: [
            { name: '✅ Bot', value: 'Conectado', inline: true },
            { name: '🔔 Alertas', value: 'Ativos', inline: true },
          ],
          footer: { text: 'DealsPro' },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
