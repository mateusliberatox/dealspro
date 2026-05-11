import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://dealspro-chi.vercel.app';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL,                        lastModified: new Date(), changeFrequency: 'always',  priority: 1.0 },
    { url: `${SITE_URL}/upgrade`,           lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.9 },
    { url: `${SITE_URL}/historico`,         lastModified: new Date(), changeFrequency: 'daily',   priority: 0.7 },
    { url: `${SITE_URL}/login`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ];

  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: products } = await admin
      .from('produtos_dealspro')
      .select('id, criado_em')
      .eq('disponivel', true)
      .order('criado_em', { ascending: false })
      .limit(500);

    const productRoutes: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
      url:             `${SITE_URL}/go/${p.id}`,
      lastModified:    new Date(p.criado_em),
      changeFrequency: 'weekly' as const,
      priority:        0.7,
    }));

    return [...staticRoutes, ...productRoutes];
  } catch {
    return staticRoutes;
  }
}
