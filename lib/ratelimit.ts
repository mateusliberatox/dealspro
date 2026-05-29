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

function inMemoryLimit(ip: string): boolean {
  const now   = Date.now();
  const entry = ipHits.get(ip);
  if (!entry || now > entry.resetAt) {
    ipHits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_REQ;
}

// ── Upstash Redis ─────────────────────────────────────────────────────────────

let _upstashLimiter: ((ip: string) => Promise<boolean>) | null = null;

async function getUpstashLimiter(): Promise<((ip: string) => Promise<boolean>) | null> {
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
    _upstashLimiter = async (ip: string) => {
      const { success } = await limiter.limit(`products:${ip}`);
      return !success;
    };
    return _upstashLimiter;
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function isRateLimited(ip: string): Promise<boolean> {
  const upstash = await getUpstashLimiter();
  if (upstash) return upstash(ip);
  return inMemoryLimit(ip);
}
