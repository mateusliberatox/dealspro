import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const GITHUB_TOKEN = process.env.GH_PAT;
const REPO         = 'mateusliberatox/dealspro';
const WORKFLOW     = 'scraper.yml';
const CRON_SECRET  = process.env.CRON_SECRET;

/**
 * POST /api/cron/trigger
 * Called by cron-job.org every 3-5 minutes.
 * Dispatches the GitHub Actions scraper workflow, bypassing the unreliable
 * GitHub scheduler which can delay by 1-2h during peak hours.
 *
 * Requires headers:
 *   x-cron-secret: <CRON_SECRET env var>
 *
 * Requires env vars:
 *   GITHUB_PAT     — personal access token with actions:write scope
 *   CRON_SECRET    — shared secret to authenticate the cron caller
 */
export async function POST(request: NextRequest) {
  // Auth check
  const secret = request.headers.get('x-cron-secret');
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!GITHUB_TOKEN) {
    return NextResponse.json({ error: 'GITHUB_PAT not configured' }, { status: 500 });
  }

  const res = await fetch(
    `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: 'main' }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: `GitHub API error: ${body}` }, { status: 502 });
  }

  // Expira planos vencidos (PIX e trials sem stripe_subscription_id)
  // Roda a cada ciclo do cron para não depender de page load
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const { data: expired } = await db
      .from('dealspro_profiles')
      .update({ plan: 'free' })
      .eq('plan', 'premium')
      .is('stripe_subscription_id', null)
      .lt('plan_expires_at', new Date().toISOString())
      .not('plan_expires_at', 'is', null)
      .select('user_id');
    if (expired && expired.length > 0) console.log(`[cron] ${expired.length} plano(s) expirado(s) revertidos para free`);
  } catch (e) {
    console.warn('[cron] expire-plans falhou:', e);
  }

  return NextResponse.json({ ok: true, triggered_at: new Date().toISOString() });
}
