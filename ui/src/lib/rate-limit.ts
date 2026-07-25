// TinyHub — in-memory rate limiter (token bucket per key).
// Fixes original bug: only writes were rate-limited; expensive reads were not.

interface Bucket {
  tokens: number;
  last: number;
}

const buckets = new Map<string, Bucket>();
const CAPACITY = 60; // tokens
const REFILL_PER_SEC = 30; // refill rate

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  retryAfter: number;
}

export function rateLimit(key: string, cost = 1): RateLimitResult {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: CAPACITY, last: now };
    buckets.set(key, b);
  }
  const elapsed = (now - b.last) / 1000;
  b.tokens = Math.min(CAPACITY, b.tokens + elapsed * REFILL_PER_SEC);
  b.last = now;
  if (b.tokens >= cost) {
    b.tokens -= cost;
    return { success: true, remaining: Math.floor(b.tokens), retryAfter: 0 };
  }
  const need = cost - b.tokens;
  const retryAfter = Math.ceil((need / REFILL_PER_SEC) * 1000);
  return { success: false, remaining: 0, retryAfter };
}

/// Client IP extraction (behind Caddy gateway).
export function clientIp(request: Request): string {
  return (
    request.headers.get("X-Real-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    request.headers.get("CF-Connecting-IP") ||
    "unknown"
  );
}

/// Periodic cleanup of stale buckets (call occasionally).
export function pruneBuckets(maxAgeMs = 10 * 60 * 1000): void {
  const now = Date.now();
  for (const [k, b] of buckets) {
    if (now - b.last > maxAgeMs) buckets.delete(k);
  }
}
