import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';
import { SITE_URL } from '@/lib/site';

export const revalidate = 3600;

const CATEGORY_SLUGS = [
  'roupas', 'calcados', 'bolsas', 'acessorios', 'smartwatch', 'eletronicos', 'outros',
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL,                                   lastModified: now, changeFrequency: 'always',  priority: 1.0 },
    { url: `${SITE_URL}/ranking`,                      lastModified: now, changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${SITE_URL}/frete`,                        lastModified: now, changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${SITE_URL}/vendedores`,                   lastModified: now, changeFrequency: 'weekly',  priority: 0.7 },
    { url: `${SITE_URL}/sugestoes`,                    lastModified: now, changeFrequency: 'daily',   priority: 0.6 },
    { url: `${SITE_URL}/upgrade`,                      lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${SITE_URL}/faq`,                          lastModified: now, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/sobre`,                        lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/login`,                        lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/politica-de-privacidade`,      lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${SITE_URL}/termos`,                       lastModified: now, changeFrequency: 'yearly',  priority: 0.3 },
  ];

  const categoryRoutes: MetadataRoute.Sitemap = CATEGORY_SLUGS.map((slug) => ({
    url:             `${SITE_URL}/categoria/${slug}`,
    lastModified:    now,
    changeFrequency: 'always' as const,
    priority:        0.85,
  }));

  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: products } = await admin
      .from('produtos_dealspro')
      .select('id, criado_em')
      .eq('disponivel', true)
      .lte('visible_at', now.toISOString())
      .order('criado_em', { ascending: false })
      .limit(500);

    const productRoutes: MetadataRoute.Sitemap = (products ?? []).map((p) => ({
      url:             `${SITE_URL}/go/${p.id}`,
      lastModified:    new Date(p.criado_em),
      changeFrequency: 'weekly' as const,
      priority:        0.5,
    }));

    return [...staticRoutes, ...categoryRoutes, ...productRoutes];
  } catch {
    return [...staticRoutes, ...categoryRoutes];
  }
}
