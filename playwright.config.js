import { defineConfig, devices } from '@playwright/test'

// Tests run against the Vite dev server with FAKE Firebase settings, so no real
// project / secrets are needed (and the real .env.local is overridden).
const PORT = Number(process.env.E2E_PORT || 5174)
const fakeFirebase = {
  VITE_FIREBASE_API_KEY: 'fake-api-key',
  VITE_FIREBASE_AUTH_DOMAIN: 'fake-project.firebaseapp.com',
  VITE_FIREBASE_PROJECT_ID: 'fake-project',
  VITE_FIREBASE_STORAGE_BUCKET: 'fake-project.appspot.com',
  VITE_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  VITE_FIREBASE_APP_ID: '1:000000000000:web:fake',
}

export default defineConfig({
  testDir: './tests',
  timeout: 120_000,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    { name: 'unit', testDir: './tests/unit' },
    {
      name: 'e2e',
      testDir: './tests/e2e',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Software WebGL so results are identical on any machine / CI without a GPU
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] },
      },
    },
  ],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: fakeFirebase,
    timeout: 60_000,
  },
})
