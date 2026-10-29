import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Runs the Vercel functions in /api during `npm run dev`, so local development
// behaves like production. Server-only secrets (e.g. HF_TOKEN, no VITE_ prefix)
// are read from .env.local and never reach the browser bundle.
function localApi() {
  return {
    name: 'foldify-local-api',
    configureServer(server) {
      server.middlewares.use('/api/generate-image', async (req, res) => {
        const mod = await server.ssrLoadModule('/api/generate-image.js')
        await mod.default(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of ['HF_TOKEN', 'HF_MODEL_URL', 'AI_LIMIT_PER_MINUTE', 'AI_LIMIT_PER_DAY', 'AI_LIMIT_GLOBAL_DAY', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) {
    if (env[key] && !process.env[key]) process.env[key] = env[key]
  }
  return {
    plugins: [react(), localApi()],
  }
})
