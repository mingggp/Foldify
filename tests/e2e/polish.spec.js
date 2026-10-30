import { test, expect } from '@playwright/test'

test.use({ viewport: { width: 1180, height: 820 } })
const ready = (page) => page.waitForFunction(() => window.__foldify?.three && window.__foldify?.state, null, { timeout: 30_000 })

test('no browser right-click menu, except in text fields', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  const prevented = (sel) => page.evaluate((sel) => {
    const el = document.querySelector(sel)
    const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    el.dispatchEvent(e)
    return e.defaultPrevented
  }, sel)
  expect(await prevented('canvas')).toBe(true)
  expect(await prevented('[data-testid=smart-scan]')).toBe(true)
  await page.getByTestId('open-share').click()
  expect(await prevented('[data-testid=share-link]')).toBe(false)
})

test('picking a face does not repaint face textures (fast taps)', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  // count 2D canvas texture repaints (paintFace calls ctx.fillRect over the whole 1024 face)
  await page.evaluate(() => {
    window.__repaints = 0
    const orig = CanvasRenderingContext2D.prototype.fillRect
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, w, h) {
      if (w === 1024 && h === 1024) window.__repaints++
      return orig.call(this, x, y, w, h)
    }
  })
  await page.getByRole('radio', { name: 'Decorate' }).click()
  for (const id of ['top', 'left', 'right', 'front']) await page.getByTestId(`face-chip-${id}`).click()
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => window.__repaints)).toBe(0)
  // and the selected face has the animated outline in 3D
  const glow = await page.evaluate(() => {
    let n = 0
    window.__foldify.three.scene.traverse((o) => { if (o.name === 'selection-glow') n++ })
    return n
  })
  expect(glow).toBe(1)
})

test('export: preview is the saved picture, without the selection outline', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await page.evaluate(() => { const f = window.__foldify; f.setFoldProgress(1); f.setSelectedFace('front') })
  await page.getByTestId('open-export').click()
  const preview = page.getByTestId('export-preview')
  await expect(preview).toBeVisible({ timeout: 60_000 })
  const first = await preview.getAttribute('src')
  // the scene still has its selection outline, but the export hid it while rendering
  expect(await page.evaluate(() => { let v = null; window.__foldify.three.scene.traverse((o) => { if (o.name === 'selection-glow') v = o.visible }); return v })).toBe(true)
  // white background, square, 2048 px
  const info = await page.evaluate(async (src) => {
    const img = new Image(); img.src = src; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
    const corner = ctx.getImageData(4, 4, 1, 1).data
    // any amber selection-outline pixels? (#ffb238)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let amber = 0
    for (let i = 0; i < d.length; i += 4 * 7) if (d[i] > 240 && d[i + 1] > 160 && d[i + 1] < 200 && d[i + 2] < 90) amber++
    return { w: img.width, h: img.height, corner: [...corner], amber }
  }, first)
  expect([info.w, info.h]).toEqual([2048, 2048])
  expect(info.corner).toEqual([255, 255, 255, 255])
  expect(info.amber).toBe(0)
  // turning the grid on makes a new picture
  await page.getByTestId('export-grid').check()
  await expect(preview).not.toHaveAttribute('src', first, { timeout: 60_000 })
})

test('scan help pops up with the how-to', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await page.getByTestId('scan-help').hover()
  await expect(page.getByTestId('scan-help-pop')).toBeVisible()
  await expect(page.getByTestId('scan-help-pop')).toContainText(/Press Scan|กดปุ่มสแกน/)
  await page.mouse.move(900, 600)
  await expect(page.getByTestId('scan-help-pop')).toHaveCount(0)
})
