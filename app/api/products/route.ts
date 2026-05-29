import { createClient } from '@/lib/supabase/server';
import { PRODUTO_COLS } from '@/lib/types';
import { effectivePlan } from '@/lib/plan';
import { isRateLimited } from '@/lib/ratelimit';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit     = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const categoria = searchParams.get('categoria');
  const since     = searchParams.get('since'); // ISO timestamp — usado pelo live feed

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: { user } } = await supabase.auth.getUser();

  let isPremium = false;
  if (user) {
    const { data: profile } = await supabase
      .from('dealspro_profiles')
      .select('plan, plan_expires_at, stripe_subscription_id')
      .eq('user_id', user.id)
      .single();
    isPremium = effectivePlan(profile) === 'premium';
  }

  // Rate limit só para não-autenticados (Upstash Redis se configurado, fallback in-memory)
  if (!user) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
    if (await isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429, headers: { 'Retry-After': '60' } },
      );
    }
  }

  let query = supabase
    .from('produtos_dealspro')
    .select(PRODUTO_COLS)
    .eq('disponivel', true)
    .order('criado_em', { ascending: false })
    .limit(limit);

  if (!isPremium)  query = query.lte('visible_at', now);
  if (categoria)   query = query.eq('categoria', categoria);
  if (since)       query = query.gt('criado_em', since);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const response = NextResponse.json({ total: data.length, produtos: data });

  // Cache CDN de 30s para respostas públicas (reduz chamadas repetidas de bots)
  if (!isPremium) {
    response.headers.set('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
  } else {
    response.headers.set('Cache-Control', 'no-store');
  }

  return response;
}
