// Every e2e test runs the app in English (the app itself starts in Thai),
// so tests can find buttons by their English names.
import { test as base, expect } from '@playwright/test'

export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.addInitScript(() => {
      try { if (!localStorage.getItem('appLang')) localStorage.setItem('appLang', 'en') } catch { /* ignore */ }
    })
    await provide(context)
  },
})
export { expect }
