// GET /api/extension/orders
// Retorna encomendas ativas do usuário para exibir no popup da extensão.
// Requer Authorization: Bearer <token>

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization',
};

const STATUS_LABEL: Record<string, string> = {
  pending:          '⏳ Aguardando',
  in_transit:       '✈️ Em trânsito',
  out_for_delivery: '🚚 Saiu p/ entrega',
  delivered:        '✅ Entregue',
  failed:           '❌ Falhou',
  returned:         '↩️ Devolvido',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: NextRequest) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });

  const userClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );

  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401, headers: CORS });

  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: orders } = await db
    .from('user_orders')
    .select('id, tracking_code, description, status, last_event, last_event_at, carrier_code')
    .eq('user_id', user.id)
    .not('status', 'in', '("delivered","failed","returned")')
    .order('updated_at', { ascending: false })
    .limit(10);

  const result = (orders ?? []).map((o: {
    id: string; tracking_code: string; description?: string | null;
    status: string; last_event?: string | null; last_event_at?: string | null; carrier_code?: string | null;
  }) => ({
    id:           o.id,
    code:         o.tracking_code,
    description:  o.description ?? o.tracking_code,
    status:       o.status,
    statusLabel:  STATUS_LABEL[o.status] ?? o.status,
    lastEvent:    o.last_event ?? null,
    carrier:      o.carrier_code ?? null,
  }));

  return NextResponse.json({ orders: result }, { headers: CORS });
}
