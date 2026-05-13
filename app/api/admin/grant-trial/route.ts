import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Verifica se quem chama é admin
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  const { data: profile } = await supabase
    .from('dealspro_profiles')
    .select('is_admin')
    .eq('user_id', user.id)
    .single();

  if (!profile?.is_admin) return NextResponse.json({ error: 'Acesso restrito' }, { status: 403 });

  const { email, hours } = await request.json() as { email: string; hours: number };

  if (!email || !hours || hours < 1 || hours > 720) {
    return NextResponse.json({ error: 'Informe email e horas (1–720)' }, { status: 400 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Busca usuário pelo email
  const { data: { users }, error: listErr } = await admin.auth.admin.listUsers();
  if (listErr) return NextResponse.json({ error: listErr.message }, { status: 500 });

  const target = users.find((u) => u.email === email);
  if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const trialEndsAt = new Date(Date.now() + hours * 3_600_000).toISOString();

  const { error: updateErr } = await admin
    .from('dealspro_profiles')
    .update({ plan: 'premium', plan_expires_at: trialEndsAt })
    .eq('user_id', target.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  console.log(JSON.stringify({
    audit: 'grant_trial',
    by:    user.id,
    target: target.id,
    email,
    hours,
    trial_ends_at: trialEndsAt,
    at: new Date().toISOString(),
  }));

  return NextResponse.json({ ok: true, email, trial_ends_at: trialEndsAt, hours });
}
