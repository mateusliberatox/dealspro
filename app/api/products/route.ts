import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 200);
  const categoria = searchParams.get('categoria');

  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: { user } } = await supabase.auth.getUser();

  let isPremium = false;
  if (user) {
    const { data: profile } = await supabase
      .from('dealspro_profiles')
      .select('plan')
      .eq('user_id', user.id)
      .single();
    isPremium = profile?.plan === 'premium';
  }

  let query = supabase
    .from('produtos_dealspro')
    .select('*')
    .order('criado_em', { ascending: false })
    .limit(limit);

  if (!isPremium) query = query.lte('visible_at', now);
  if (categoria) query = query.eq('categoria', categoria);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ total: data.length, produtos: data });
}
