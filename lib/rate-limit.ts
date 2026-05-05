type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export function checkRateLimit(key: string, maxRequests: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (current.count >= maxRequests) {
    return { allowed: false, retryAfterMs: current.resetAt - now };
  }

  current.count += 1;
  buckets.set(key, current);
  return { allowed: true, retryAfterMs: 0 };
}

export function cleanupRateLimitBuckets() {
  const now = Date.now();
  for (const [key, value] of buckets.entries()) {
    if (value.resetAt < now) {
      buckets.delete(key);
    }
  }
}

