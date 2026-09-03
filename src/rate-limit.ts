/**
 * Kevyt in-memory rate limit Gatewaylle (yksi pitkäikäinen prosessi).
 *
 * Token bucket per asiakas (customerId). Rajat plan-kohtaisia. Tarkoitettu
 * väärinkäytön hillitsemiseen, ei tarkkaan laskutukseen – tuotannossa korvataan
 * jaetulla laskurilla (esim. Redis) jos gateway skaalataan monelle instanssille.
 */

export type Plan = "free" | "pro" | "enterprise";

interface PlanLimits {
  /** Työkalukutsuja / minuutti (POST /messages, POST /mcp). */
  callsPerMinute: number;
  /** Rinnakkaisia SSE-sessioita per asiakas. */
  maxConcurrentSessions: number;
}

const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  free: { callsPerMinute: 20, maxConcurrentSessions: 3 },
  pro: { callsPerMinute: 120, maxConcurrentSessions: 10 },
  enterprise: { callsPerMinute: 600, maxConcurrentSessions: 50 },
};

export function limitsFor(plan: string): PlanLimits {
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free;
}

interface Bucket {
  tokens: number;
  updated: number;
}

const buckets = new Map<string, Bucket>();

export interface RateResult {
  allowed: boolean;
  /** Jäljellä olevat kutsut (kokonaisluku). */
  remaining: number;
  /** Kokonaiskapasiteetti / minuutti. */
  limit: number;
  /** Sekunteja seuraavaan sallittuun kutsuun (vain kun !allowed). */
  retryAfterSec: number;
}

/** Kuluta yksi "token". Kutsu kerran per työkalukutsu. */
export function consume(customerId: string, plan: string, now = Date.now()): RateResult {
  const { callsPerMinute } = limitsFor(plan);
  const refillPerMs = callsPerMinute / 60_000;

  let b = buckets.get(customerId);
  if (!b) {
    b = { tokens: callsPerMinute, updated: now };
    buckets.set(customerId, b);
  }

  b.tokens = Math.min(callsPerMinute, b.tokens + (now - b.updated) * refillPerMs);
  b.updated = now;

  if (b.tokens < 1) {
    return {
      allowed: false,
      remaining: 0,
      limit: callsPerMinute,
      retryAfterSec: Math.max(1, Math.ceil((1 - b.tokens) / refillPerMs / 1000)),
    };
  }

  b.tokens -= 1;
  return {
    allowed: true,
    remaining: Math.floor(b.tokens),
    limit: callsPerMinute,
    retryAfterSec: 0,
  };
}

/** Vain testejä varten: nollaa laskurit. */
export function _resetBuckets(): void {
  buckets.clear();
}
