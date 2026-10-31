import { test, expect } from '@playwright/test'

const ready = (page) => page.waitForFunction(() => window.__foldify?.three && window.__foldify?.state, null, { timeout: 30_000 })

test.describe('PC / iPad landscape', () => {
  test.use({ viewport: { width: 1180, height: 820 } })

  test('camera starts above the table, not side-on', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    await page.waitForTimeout(300)
    const y = await page.evaluate(() => window.__foldify.three.camera.position.y)
    expect(y).toBeGreaterThan(6)
  })

  test('Fold button folds with an animation, then unfolds', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    const play = page.getByTestId('fold-play')
    await play.click()
    // part way through, it is moving
    await page.waitForFunction(() => window.__foldify.state.foldProgress > 0.05 && window.__foldify.state.foldProgress < 0.95, null, { timeout: 3000 })
    await page.waitForFunction(() => window.__foldify.state.foldProgress === 1, null, { timeout: 5000 })
    await play.click()
    await page.waitForFunction(() => window.__foldify.state.foldProgress === 0, null, { timeout: 5000 })
  })

  test('pick a face, give it a colour', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    await page.getByRole('radio', { name: 'Decorate' }).click()
    await page.getByTestId('face-chip-left').click()
    await page.getByRole('button', { name: '#ffb238' }).click()
    await page.waitForFunction(() => window.__foldify.state.facesConfig.left.color === '#ffb238')
    // clicking a face elsewhere (here: through the app state) keeps the decorate tab
    await page.evaluate(() => window.__foldify.setSelectedFace('top'))
    await expect(page.getByTestId('face-chip-top')).toHaveAttribute('aria-checked', 'true')
  })

  test('theme setting switches the page to dark and is remembered', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('radio', { name: 'Dark' }).click()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('settings')).toHaveCount(0)
    await page.reload()
    await ready(page)
    await expect(page.locator('html')).toHaveClass(/dark/)
  })
})

test.describe('iPad portrait', () => {
  test.use({ viewport: { width: 820, height: 1180 } })

  test('tools panel opens as a drawer and closes again', async ({ page }) => {
    await page.goto('/')
    await ready(page)
    const scan = page.getByTestId('smart-scan')
    await expect(scan).not.toBeInViewport()
    await page.getByTestId('open-panel').click()
    await expect(scan).toBeInViewport()
    await page.getByRole('button', { name: 'Close' }).first().click()
    await expect(scan).not.toBeInViewport()
  })
})
