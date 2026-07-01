import type { Request, Response, NextFunction } from "express";

interface RateWindow {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateWindow>();

function defaultRateLimitPerMinute(): number {
  return Number(process.env.DEFAULT_API_KEY_RATE_LIMIT_PER_MINUTE ?? 120);
}

function legacyBucketKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  return `legacy:${ip}`;
}

function resolveLimit(req: Request): number {
  if (req.apiKeyId) {
    return req.apiKeyRateLimitPerMinute ?? defaultRateLimitPerMinute();
  }
  return defaultRateLimitPerMinute();
}

function checkAndIncrement(key: string, limit: number): boolean {
  const now = Date.now();
  let window = buckets.get(key);

  if (!window || now >= window.resetAt) {
    window = { count: 0, resetAt: now + 60_000 };
    buckets.set(key, window);
  }

  if (window.count >= limit) return false;
  window.count += 1;
  return true;
}

/**
 * Per-API-key fixed-window rate limiter (requests per minute).
 * Uses rate_limit_per_minute from the authenticated key when set, else
 * DEFAULT_API_KEY_RATE_LIMIT_PER_MINUTE. Legacy ENGINE_ACCESS_KEYS use a
 * per-IP bucket with the same default.
 */
export function rateLimitByApiKey(req: Request, res: Response, next: NextFunction): void {
  const bucketKey = req.apiKeyId ?? legacyBucketKey(req);
  const limit = resolveLimit(req);

  if (!checkAndIncrement(bucketKey, limit)) {
    res.status(429).json({
      error: "Rate limit exceeded for this API key. Try again in a minute.",
      limitPerMinute: limit,
    });
    return;
  }

  next();
}

/** @internal Test helper */
export function resetRateLimitBucketsForTests(): void {
  buckets.clear();
}
