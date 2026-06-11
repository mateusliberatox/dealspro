// GET /api/extension/seller?name=XYZ
// Retorna avaliações de um seller do DealsPro.
// Chamado pela extensão — sem autenticação.

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { isRateLimited } from '@/lib/ratelimit';

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET', 'Cache-Control': 'public, max-age=120' };

export async function GET(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (await isRateLimited(ip, 'extension')) {
    return NextResponse.json({ found: false }, { status: 429, headers: { ...CORS, 'Retry-After': '60' } });
  }

  const name = request.nextUrl.searchParams.get('name')?.trim();
  if (!name || name.length < 2) return NextResponse.json({ found: false }, { headers: CORS });

  // Busca seller aprovado com nome parecido
  const { data: sellers } = await db
    .from('sellers')
    .select('id, name')
    .eq('status', 'approved')
    .ilike('name', `%${name}%`)
    .limit(1);

  if (!sellers?.length) return NextResponse.json({ found: false }, { headers: CORS });

  const seller = sellers[0] as { id: number; name: string };

  const { data: ratings } = await db
    .from('seller_ratings')
    .select('nota, comentario, created_at')
    .eq('seller_id', seller.id)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!ratings?.length) return NextResponse.json({ found: false }, { headers: CORS });

  const total  = ratings.length;
  const avg    = ratings.reduce((s, r) => s + (r as { nota: number }).nota, 0) / total;
  const recent = (ratings as Array<{ nota: number; comentario?: string | null }>)
    .filter((r) => r.comentario)
    .slice(0, 2)
    .map((r) => ({ nota: r.nota, comentario: r.comentario }));

  return NextResponse.json({
    found: true,
    seller: { name: seller.name, avg: parseFloat(avg.toFixed(1)), total, recent },
  }, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
