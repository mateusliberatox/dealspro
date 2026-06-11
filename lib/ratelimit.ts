// Rate limiting com Upstash Redis (stateful, cross-instance).
// Se UPSTASH_REDIS_REST_URL não estiver configurado, cai silenciosamente
// para o fallback in-memory (adequado para instância única / dev).

const WINDOW_MS = 60_000;
const MAX_REQ   = 30;

// ── Fallback in-memory ────────────────────────────────────────────────────────

const ipHits = new Map<string, { count: number; resetAt: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of ipHits) if (now > e.resetAt) ipHits.delete(ip);
}, 5 * 60_000).unref();

function inMemoryLimit(key: string): boolean {
  const now   = Date.now();
  const entry = ipHits.get(key);
  if (!entry || now > entry.resetAt) {
    ipHits.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQ;
}

// ── Upstash Redis ─────────────────────────────────────────────────────────────

let _upstashLimiter: ((key: string) => Promise<boolean>) | null = null;

async function getUpstashLimiter(): Promise<((key: string) => Promise<boolean>) | null> {
  if (_upstashLimiter) return _upstashLimiter;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;

  try {
    const { Ratelimit } = await import('@upstash/ratelimit');
    const { Redis }     = await import('@upstash/redis');
    const limiter = new Ratelimit({
      redis:   new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN }),
      limiter: Ratelimit.slidingWindow(MAX_REQ, '1 m'),
      prefix:  'dealspro:rl',
    });
    _upstashLimiter = async (key: string) => {
      const { success } = await limiter.limit(key);
      return !success;
    };
    return _upstashLimiter;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * @param scope Identifica o bucket de rate limit (cada scope tem sua própria janela por IP).
 */
export async function isRateLimited(ip: string, scope = 'products'): Promise<boolean> {
  const key = `${scope}:${ip}`;
  const upstash = await getUpstashLimiter();
  if (upstash) return upstash(key);
  return inMemoryLimit(key);
}
