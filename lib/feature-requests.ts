import { createClient } from '@supabase/supabase-js';

export type FeatureStatus = 'planejado' | 'em_desenvolvimento' | 'concluido';

export interface FeatureRequest {
  id: number;
  title: string;
  description: string | null;
  category: string;
  status: FeatureStatus;
  isPro: boolean;
  votes: number;
  votedByUser: boolean;
}

export const CATEGORY_LABELS: Record<string, string> = {
  precos:       'Preços & Custos',
  vendedores:   'Vendedores',
  plataforma:   'Plataforma',
  inteligencia: 'Inteligência',
  logistica:    'Logística & Pagamentos',
  geral:        'Geral',
};

export const STATUS_LABELS: Record<FeatureStatus, string> = {
  concluido:           '✅ Concluído',
  em_desenvolvimento:  '🚧 Em desenvolvimento',
  planejado:           '📋 Planejado',
};

/**
 * Retorna o roadmap público (feature_requests) com a contagem de votos de
 * cada item e, se `userId` for informado, se o usuário já votou em cada um.
 * Usado pela página `/sugestoes`.
 */
export async function getFeatureRequests(userId?: string): Promise<FeatureRequest[]> {
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: features } = await db
    .from('feature_requests')
    .select('id, title, description, category, status, is_pro, sort_order')
    .order('sort_order');

  if (!features?.length) return [];

  const ids = (features as Array<{ id: number }>).map((f) => f.id);

  const { data: votes } = await db
    .from('feature_votes')
    .select('feature_id, user_id')
    .in('feature_id', ids);

  const counts = new Map<number, number>();
  const votedByUser = new Set<number>();
  for (const v of (votes ?? []) as Array<{ feature_id: number; user_id: string }>) {
    counts.set(v.feature_id, (counts.get(v.feature_id) ?? 0) + 1);
    if (userId && v.user_id === userId) votedByUser.add(v.feature_id);
  }

  return (features as Array<{
    id: number; title: string; description: string | null; category: string;
    status: FeatureStatus; is_pro: boolean; sort_order: number;
  }>).map((f) => ({
    id:          f.id,
    title:       f.title,
    description: f.description,
    category:    f.category,
    status:      f.status,
    isPro:       f.is_pro,
    votes:       counts.get(f.id) ?? 0,
    votedByUser: votedByUser.has(f.id),
  }));
}
