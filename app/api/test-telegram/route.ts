import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('telegram_chat_id')
    .eq('user_id', user.id)
    .single();

  if (!profile?.telegram_chat_id) {
    return NextResponse.json({ error: 'Telegram não vinculado' }, { status: 400 });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ error: 'Bot não configurado' }, { status: 500 });

  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:    profile.telegram_chat_id,
      text:       '✅ <b>Teste de notificação DealsPro</b>\n\nSeus alertas e deals chegarão aqui. Tudo certo!',
      parse_mode: 'HTML',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return NextResponse.json({ error: (err as { description?: string }).description ?? 'Falha ao enviar' }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
