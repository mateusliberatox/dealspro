import { createClient } from '@supabase/supabase-js';

/**
 * Resumo de avaliações de um vendedor (seller) aprovado — usado pela página
 * pública `/vendedores`. As avaliações em si são feitas via Discord
 * (`/avaliar-seller`, ver app/api/discord/interactions/route.ts); esta
 * função apenas agrega o que já está no Supabase.
 */
export interface SellerSummary {
  id: number;
  name: string;
  avg: number;
  total: number;
  recentComments: string[];
}

/**
 * Retorna os vendedores aprovados que já têm pelo menos 1 avaliação,
 * ordenados por número de avaliações (desc) e depois por nota média (desc).
 */
export async function getApprovedSellers(): Promise<SellerSummary[]> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: sellers } = await db
    .from('sellers')
    .select('id, name')
    .eq('status', 'approved')
    .order('name');

  if (!sellers?.length) return [];

  const ids = sellers.map((s) => (s as { id: number }).id);

  const { data: ratings } = await db
    .from('seller_ratings')
    .select('seller_id, nota, comentario')
    .in('seller_id', ids);

  const bySeller = new Map<number, { sum: number; count: number; comments: string[] }>();
  for (const r of (ratings ?? []) as Array<{ seller_id: number; nota: number; comentario: string | null }>) {
    const entry = bySeller.get(r.seller_id) ?? { sum: 0, count: 0, comments: [] };
    entry.sum += r.nota;
    entry.count += 1;
    if (r.comentario) entry.comments.push(r.comentario);
    bySeller.set(r.seller_id, entry);
  }

  return (sellers as Array<{ id: number; name: string }>)
    .map((s) => {
      const agg = bySeller.get(s.id);
      return {
        id:             s.id,
        name:           s.name,
        avg:            agg ? parseFloat((agg.sum / agg.count).toFixed(1)) : 0,
        total:          agg?.count ?? 0,
        recentComments: (agg?.comments ?? []).slice(0, 2),
      };
    })
    .filter((s) => s.total > 0)
    .sort((a, b) => b.total - a.total || b.avg - a.avg);
}
