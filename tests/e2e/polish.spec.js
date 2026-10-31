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

test('export: live preview, wheel zoom, grid even when the app grid is off; saved PNG has no selection', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await page.evaluate(() => { const f = window.__foldify; f.setFoldProgress(1); f.setSelectedFace('front'); f.setShowGrid(false) })
  await page.getByTestId('open-export').click()
  const preview = page.getByTestId('export-preview')
  await expect(preview).toBeVisible()
  // 'ink' = drawn, non-white pixels (a fresh canvas is transparent, which doesn't count)
  const snap = () => preview.evaluate((c) => { const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 0; i < d.length; i += 16) { if (d[i + 3] === 255 && (d[i] < 245 || d[i + 1] < 245 || d[i + 2] < 245)) ink++ } return { ink, w: c.width } })
  await expect.poll(async () => (await snap()).ink, { timeout: 60_000 }).toBeGreaterThan(1000)
  const before = (await snap()).ink

  // wheel over the picture zooms in: the box covers more of the picture
  await preview.hover()
  await page.mouse.wheel(0, -600)
  await expect.poll(async () => (await snap()).ink, { timeout: 60_000 }).toBeGreaterThan(before * 1.3)

  // grid on, although the grid is switched off in the app
  const zoomed = (await snap()).ink
  await page.getByTestId('export-grid').check()
  await expect.poll(async () => (await snap()).ink, { timeout: 60_000 }).toBeGreaterThan(zoomed + 2000) // thin grid lines appear around the box
  await page.getByTestId('export-grid').uncheck()

  // the saved picture: 2048 px, white corners, no amber selection outline; selection stays on screen
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 120_000 }), page.getByTestId('export-save').click()])
  const b64 = (await (await import('node:fs/promises')).readFile(await download.path())).toString('base64')
  const info = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
    const d = ctx.getImageData(0, 0, c.width, c.height).data
    let amber = 0
    for (let i = 0; i < d.length; i += 4 * 7) if (d[i] > 240 && d[i + 1] > 160 && d[i + 1] < 200 && d[i + 2] < 90) amber++
    return { w: img.width, h: img.height, corner: [...ctx.getImageData(4, 4, 1, 1).data], amber }
  }, b64)
  expect([info.w, info.h]).toEqual([2048, 2048])
  expect(info.corner).toEqual([255, 255, 255, 255])
  expect(info.amber).toBe(0)
  expect(await page.evaluate(() => { let v = null; window.__foldify.three.scene.traverse((o) => { if (o.name === 'selection-glow') v = o.visible }); return v })).toBe(true)
  expect(await page.evaluate(() => { let v = null; window.__foldify.three.scene.traverse((o) => { if (o.name === 'floor-grid') v = o.visible }); return v })).toBe(false)
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

test('face letters sit in the middle of the face', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  const off = await page.evaluate(async () => {
    const { makeLabelTexture } = await import('/src/lib/labelTexture.js')
    const out = {}
    for (const label of ['A', 'F', 'g', 'กิ', 'ป', '12']) {
      const img = new Image(); img.src = makeLabelTexture(label); await img.decode()
      const c = document.createElement('canvas'); c.width = c.height = 512
      const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, 512, 512).data
      let minX = 512, maxX = 0, minY = 512, maxY = 0
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
        if (d[(y * 512 + x) * 4] < 128) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
      }
      out[label] = [(minX + maxX) / 2 - 256, (minY + maxY) / 2 - 256]
    }
    return out
  })
  for (const [label, [dx, dy]] of Object.entries(off)) {
    expect(Math.abs(dx), `${label} x`).toBeLessThan(6)
    expect(Math.abs(dy), `${label} y`).toBeLessThan(6)
  }
})
