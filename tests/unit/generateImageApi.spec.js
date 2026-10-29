import { test, expect } from '@playwright/test'
import { Readable } from 'node:stream'
import handler from '../../api/generate-image.js'
import { resetMemoryLimits } from '../../api/_lib/rateLimit.js'

function call({ method = 'POST', body, headers = {}, ip = '1.2.3.4' } = {}) {
  const raw = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
  const req = Readable.from(raw ? [Buffer.from(raw)] : [])
  req.method = method
  req.headers = { host: 'foldify.test', 'x-forwarded-for': ip, ...headers }
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v },
      end(data) {
        const buf = Buffer.isBuffer(data) ? data : Buffer.from(data || '')
        let json = null
        try { json = JSON.parse(buf.toString()) } catch { /* binary */ }
        resolve({ status: this.statusCode, headers: this.headers, json, body: buf })
      },
    }
    handler(req, res)
  })
}

const realFetch = globalThis.fetch
const env = { ...process.env }

test.beforeEach(() => {
  resetMemoryLimits()
  process.env.HF_TOKEN = 'hf_test_token'
  process.env.AI_LIMIT_PER_MINUTE = '2'
  process.env.AI_LIMIT_PER_DAY = '5'
  delete process.env.UPSTASH_REDIS_REST_URL
  delete process.env.KV_REST_API_URL
  globalThis.fetch = async (url, init) => {
    globalThis.lastUpstream = { url, init }
    return new Response(Buffer.from([0xff, 0xd8, 0xff]), { status: 200, headers: { 'content-type': 'image/jpeg' } })
  }
})
test.afterEach(() => {
  globalThis.fetch = realFetch
  process.env = { ...env }
})

test('proxies the prompt to Hugging Face with the SERVER token', async () => {
  const r = await call({ body: { prompt: 'wooden texture' } })
  expect(r.status).toBe(200)
  expect(r.headers['content-type']).toBe('image/jpeg')
  expect(globalThis.lastUpstream.init.headers.Authorization).toBe('Bearer hf_test_token')
  expect(JSON.parse(globalThis.lastUpstream.init.body)).toEqual({ inputs: 'wooden texture' })
})

test('rejects bad requests', async () => {
  expect((await call({ method: 'GET' })).status).toBe(405)
  expect((await call({ body: 'not json' })).json.error).toBe('invalid_json')
  expect((await call({ body: { prompt: '   ' } })).json.error).toBe('prompt_required')
  expect((await call({ body: { prompt: 'x'.repeat(301) } })).json.error).toBe('prompt_too_long')
  expect((await call({ body: { prompt: 'hi' }, headers: { origin: 'https://evil.example' } })).status).toBe(403)
  expect((await call({ body: { prompt: 'hi' }, headers: { origin: 'https://foldify.test' } })).status).toBe(200)
})

test('reports a missing server token instead of failing silently', async () => {
  delete process.env.HF_TOKEN
  expect((await call({ body: { prompt: 'hi' } })).json.error).toBe('ai_not_configured')
})

test('rate limits per IP, other visitors unaffected', async () => {
  expect((await call({ body: { prompt: 'a' } })).status).toBe(200)
  expect((await call({ body: { prompt: 'b' } })).status).toBe(200)
  const limited = await call({ body: { prompt: 'c' } })
  expect(limited.status).toBe(429)
  expect(limited.json.scope).toBe('ip-min')
  expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0)
  expect((await call({ body: { prompt: 'd' }, ip: '5.6.7.8' })).status).toBe(200)
})

test('upstream errors become clear status codes', async () => {
  globalThis.fetch = async () => new Response('loading', { status: 503 })
  expect((await call({ body: { prompt: 'a' } })).json.error).toBe('model_loading')
  globalThis.fetch = async () => new Response('{"error":"x"}', { status: 200, headers: { 'content-type': 'application/json' } })
  expect((await call({ body: { prompt: 'b' }, ip: '9.9.9.9' })).json.error).toBe('upstream_not_image')
})
