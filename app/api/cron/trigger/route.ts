import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { expireOverduePlans } from '@/lib/plan';
import { processRoleSyncQueue } from '@/lib/discord';
import { log } from '@/lib/log';

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

  // Expira planos vencidos (PIX e trials sem stripe_subscription_id).
  // Lógica centralizada em lib/plan.ts, usada também no render do feed.
  try {
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const expiredCount = await expireOverduePlans(db);
    if (expiredCount > 0) log.info('cron_expired_plans', { count: expiredCount });

    // Processa fila de retries do Discord (cargos que falharam ao adicionar/remover)
    const roleSync = await processRoleSyncQueue(db);
    if (roleSync.done + roleSync.failed + roleSync.retried > 0) {
      log.info('cron_discord_role_sync', roleSync);
    }
  } catch (e) {
    log.warn('cron_expire_error', { error: e instanceof Error ? e.message : String(e) });
  }

  return NextResponse.json({ ok: true, triggered_at: new Date().toISOString() });
}
