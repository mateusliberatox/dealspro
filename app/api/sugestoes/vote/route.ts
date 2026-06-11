import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/sugestoes/vote — alterna (vota/remove voto) o usuário logado
// em uma feature do roadmap (/sugestoes).
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { featureId?: number };
  const featureId = Number(body.featureId);
  if (!featureId || !Number.isFinite(featureId)) {
    return NextResponse.json({ error: 'featureId obrigatório' }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from('feature_votes')
    .select('id')
    .eq('feature_id', featureId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('feature_votes').delete().eq('id', existing.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await supabase.from('feature_votes').insert({
      feature_id: featureId,
      user_id:    user.id,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { count } = await supabase
    .from('feature_votes')
    .select('*', { count: 'exact', head: true })
    .eq('feature_id', featureId);

  return NextResponse.json({ voted: !existing, votes: count ?? 0 });
}
