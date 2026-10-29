// Fixed-window rate limiter.
//
// * If Upstash Redis / Vercel KV REST credentials are configured, counters are
//   shared by every serverless instance (recommended for production).
// * Otherwise it falls back to an in-memory Map. That only limits per warm
//   instance, so it is a best-effort guard, not a hard quota.

const memory = new Map();

function redisConfig(env = process.env) {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ""), token } : null;
}

async function redisIncr({ url, token }, key, windowSec) {
  // INCR + EXPIRE NX in one round trip (pipeline).
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, String(windowSec), "NX"],
    ]),
  });
  if (!res.ok) throw new Error(`Rate limit store error ${res.status}`);
  const [incr] = await res.json();
  return Number(incr.result);
}

function memoryIncr(key, windowSec, now) {
  const entry = memory.get(key);
  if (!entry || entry.expiresAt <= now) {
    memory.set(key, { count: 1, expiresAt: now + windowSec * 1000 });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

/**
 * Check a list of limits; all must pass. Each rule: { name, key, limit, windowSec }.
 * Returns { ok: true } or { ok: false, rule, retryAfter }.
 */
export async function checkLimits(rules, { env = process.env, now = Date.now() } = {}) {
  const redis = redisConfig(env);
  for (const rule of rules) {
    const windowStart = Math.floor(now / 1000 / rule.windowSec);
    const key = `foldify:rl:${rule.name}:${rule.key}:${windowStart}`;
    const count = redis ? await redisIncr(redis, key, rule.windowSec) : memoryIncr(key, rule.windowSec, now);
    if (count > rule.limit) {
      const windowEnds = (windowStart + 1) * rule.windowSec;
      return { ok: false, rule: rule.name, retryAfter: Math.max(1, Math.ceil(windowEnds - now / 1000)) };
    }
  }
  return { ok: true, store: redis ? "redis" : "memory" };
}

export function resetMemoryLimits() {
  memory.clear();
}
