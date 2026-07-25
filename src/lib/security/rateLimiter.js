// src/lib/security/rateLimiter.js
const rateCache = new Map();

// Token Bucket algorithm implementation (In-Memory per instance)
export function rateLimiter(req, { limit = 10, windowSeconds = 60, keyPrefix = 'global' } = {}) {
  // Try to get IP from headers (Vercel/Next.js standard)
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  const key = `${keyPrefix}:${ip}`;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;

  const currentStatus = rateCache.get(key) || { tokens: limit, lastRefilled: now };

  // Refill tokens based on time elapsed
  const timePassed = now - currentStatus.lastRefilled;
  const tokensToAdd = Math.floor(timePassed / (windowMs / limit));
  
  if (tokensToAdd > 0) {
    currentStatus.tokens = Math.min(limit, currentStatus.tokens + tokensToAdd);
    currentStatus.lastRefilled = now;
  }

  // Consume a token
  if (currentStatus.tokens > 0) {
    currentStatus.tokens -= 1;
    rateCache.set(key, currentStatus);
    
    return {
      success: true,
      limit,
      remaining: currentStatus.tokens,
      retryAfter: 0,
    };
  }

  // Rate limit exceeded
  const retryAfter = Math.ceil((windowMs - timePassed) / 1000);
  
  return {
    success: false,
    limit,
    remaining: 0,
    retryAfter: Math.max(1, retryAfter),
  };
}

export function buildRateLimitHeaders(rateResult) {
  return {
    'X-RateLimit-Limit': rateResult.limit.toString(),
    'X-RateLimit-Remaining': rateResult.remaining.toString(),
    'Retry-After': rateResult.retryAfter.toString(),
  };
}
