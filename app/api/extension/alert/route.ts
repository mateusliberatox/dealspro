// POST /api/extension/alert
// Cria um alerta de produto a partir da extensão Chrome.
// Requer Authorization: Bearer <supabase_access_token>

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const token      = authHeader?.replace('Bearer ', '').trim();

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  // Valida o token via Supabase Auth
  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });
  }

  // Verifica plano Premium
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: profile } = await db
    .from('dealspro_profiles')
    .select('plan')
    .eq('user_id', user.id)
    .single();

  if (profile?.plan !== 'premium') {
    return NextResponse.json(
      { error: 'Alertas são exclusivos para membros Premium.' },
      { status: 403, headers: CORS },
    );
  }

  // Lê payload
  const body = await request.json().catch(() => ({})) as {
    keyword?: string;
    categoria?: string | null;
    size?: string | null;
  };

  const keyword   = body.keyword?.trim()   ?? '';
  const categoria = body.categoria?.trim() ?? null;
  const size      = body.size?.trim()      ?? null;

  if (!keyword && !categoria) {
    return NextResponse.json({ error: 'keyword ou categoria obrigatório.' }, { status: 400, headers: CORS });
  }

  // Verifica limite (10 alertas)
  const { count } = await db
    .from('user_alerts_dealspro')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);

  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: 'Limite de 10 alertas atingido.' }, { status: 400, headers: CORS });
  }

  const { data: alert, error: insertError } = await db
    .from('user_alerts_dealspro')
    .insert({ user_id: user.id, keyword, categoria, size })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500, headers: CORS });
  }

  return NextResponse.json({ ok: true, alert }, { headers: CORS });
}
