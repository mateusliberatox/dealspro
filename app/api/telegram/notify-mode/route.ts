import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

type NotifyMode = 'alerts_only' | 'all_deals' | 'both';
const VALID: NotifyMode[] = ['alerts_only', 'all_deals', 'both'];

export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mode } = await request.json();
  if (!VALID.includes(mode)) return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });

  const { error } = await supabase
    .from('dealspro_profiles')
    .update({ telegram_notify_mode: mode })
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
