import { createClient } from '@/lib/supabase/server';
import { registerTrackings, getTrackingUpdates, trackingConfigured } from '@/lib/tracking';
import { NextRequest, NextResponse } from 'next/server';

const MAX_ORDERS = { free: 3, premium: 20 } as const;

// GET /api/pedidos — lista encomendas do usuário logado
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('user_orders')
    .select('id, tracking_code, description, status, last_event, last_event_at, carrier_code, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

// POST /api/pedidos — adiciona nova encomenda
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { tracking_code?: string; description?: string };
  const code = body.tracking_code?.trim().toUpperCase();

  if (!code || code.length < 5 || code.length > 40 || !/^[A-Z0-9]+$/i.test(code)) {
    return NextResponse.json({ error: 'Código de rastreamento inválido.' }, { status: 400 });
  }

  // Verifica plano e limite
  const { data: profile } = await supabase
    .from('dealspro_profiles').select('plan').eq('user_id', user.id).single();
  const limit = (profile?.plan === 'premium' ? MAX_ORDERS.premium : MAX_ORDERS.free);

  const { count } = await supabase
    .from('user_orders').select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .not('status', 'in', '("delivered","failed","returned")');

  if ((count ?? 0) >= limit) {
    return NextResponse.json({ error: `Limite de ${limit} encomendas ativas atingido.` }, { status: 400 });
  }

  // Verifica duplicata
  const { data: existing } = await supabase
    .from('user_orders').select('id').eq('user_id', user.id).eq('tracking_code', code).single();
  if (existing) return NextResponse.json({ error: 'Código já cadastrado.' }, { status: 409 });

  // Insere
  const { data: order, error: insertErr } = await supabase.from('user_orders').insert({
    user_id:       user.id,
    tracking_code: code,
    description:   body.description?.trim() || null,
    status:        'pending',
  }).select().single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // Tenta buscar status inicial do 17Track
  if (trackingConfigured()) {
    await registerTrackings([code]);
    const [info] = await getTrackingUpdates([code]);
    if (info && info.status !== 'pending') {
      await supabase.from('user_orders').update({
        status:          info.status,
        last_event:      info.lastEvent,
        last_event_at:   info.lastAt,
        last_checked_at: new Date().toISOString(),
        carrier_code:    info.carrier,
      }).eq('id', (order as { id: string }).id);
      return NextResponse.json({ order: { ...order, ...info } });
    }
  }

  return NextResponse.json({ order }, { status: 201 });
}

// DELETE /api/pedidos?id=UUID — remove encomenda
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

  const { error } = await supabase
    .from('user_orders').delete().eq('id', id).eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
