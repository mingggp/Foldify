// POST /api/generate-image  { "prompt": "..." }  ->  image bytes (image/jpeg or image/png)
//
// Runs on Vercel as a Serverless Function (and inside `npm run dev` through the
// small Vite plugin in vite.config.js). The Hugging Face token lives ONLY on the
// server as HF_TOKEN — it is never shipped to the browser any more.
//
// Open to everyone, protected by rate limits (all configurable with env vars):
//   AI_LIMIT_PER_MINUTE  per IP, default 4
//   AI_LIMIT_PER_DAY     per IP, default 30
//   AI_LIMIT_GLOBAL_DAY  whole site, default 500  (protects the HF quota)
// For limits shared across instances set UPSTASH_REDIS_REST_URL/TOKEN
// (or connect Vercel KV / Upstash from the Vercel Marketplace).

import { checkLimits } from "./_lib/rateLimit.js";

const HF_MODEL_URL =
  process.env.HF_MODEL_URL ||
  "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell";
const MAX_PROMPT_LENGTH = 300;

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (Buffer.isBuffer(body)) return res.end(body);
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  if (req.body !== undefined) {
    // Vercel already parsed it
    return typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 10_000) throw new Error("too_large");
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function clientIp(req) {
  const h = req.headers;
  const fwd = h["x-vercel-forwarded-for"] || h["x-real-ip"] || h["x-forwarded-for"] || "";
  return String(fwd).split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // non-browser clients; still rate limited
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
  try {
    const host = new URL(origin).host;
    return host === req.headers.host || allowed.includes(origin);
  } catch {
    return false;
  }
}

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return send(res, 405, { error: "method_not_allowed" }, { Allow: "POST" });
  }
  if (!sameOrigin(req)) {
    return send(res, 403, { error: "forbidden_origin" });
  }

  let prompt;
  try {
    const body = await readJson(req);
    prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  } catch {
    return send(res, 400, { error: "invalid_json" });
  }
  if (!prompt) return send(res, 400, { error: "prompt_required" });
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return send(res, 400, { error: "prompt_too_long", max: MAX_PROMPT_LENGTH });
  }

  const token = process.env.HF_TOKEN;
  if (!token) return send(res, 503, { error: "ai_not_configured" });

  const ip = clientIp(req);
  let limit;
  try {
    limit = await checkLimits([
      { name: "ip-min", key: ip, limit: num(process.env.AI_LIMIT_PER_MINUTE, 4), windowSec: 60 },
      { name: "ip-day", key: ip, limit: num(process.env.AI_LIMIT_PER_DAY, 30), windowSec: 86400 },
      { name: "global-day", key: "all", limit: num(process.env.AI_LIMIT_GLOBAL_DAY, 500), windowSec: 86400 },
    ]);
  } catch (err) {
    console.error("rate limit store failed", err);
    return send(res, 503, { error: "rate_limit_unavailable" });
  }
  if (!limit.ok) {
    return send(res, 429, { error: "rate_limited", scope: limit.rule, retryAfter: limit.retryAfter }, { "Retry-After": String(limit.retryAfter) });
  }

  try {
    const upstream = await fetch(HF_MODEL_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "image/*" },
      body: JSON.stringify({ inputs: prompt }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!upstream.ok) {
      const detail = (await upstream.text()).slice(0, 300);
      console.error("HF error", upstream.status, detail);
      const status = upstream.status === 503 ? 503 : 502;
      return send(res, status, { error: upstream.status === 503 ? "model_loading" : "upstream_error", status: upstream.status });
    }
    const type = upstream.headers.get("content-type") || "image/jpeg";
    if (!type.startsWith("image/")) return send(res, 502, { error: "upstream_not_image" });
    const bytes = Buffer.from(await upstream.arrayBuffer());
    return send(res, 200, bytes, { "Content-Type": type, "Cache-Control": "no-store" });
  } catch (err) {
    console.error("HF request failed", err);
    return send(res, 504, { error: "upstream_timeout" });
  }
}
