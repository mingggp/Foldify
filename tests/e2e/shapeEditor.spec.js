import { test, expect } from './fixtures.js'
import { installProbe, settle } from './helpers.js'

test.use({ viewport: { width: 1366, height: 1024 } }) // iPad Pro landscape

const ready = (page) => page.waitForFunction(() => window.__foldify?.three && window.__foldify?.state, null, { timeout: 30_000 })
const shapesOf = (page, face) => page.evaluate((f) => window.__foldify.state.facesConfig[f].shapes, face)

async function openEditor(page, face) {
  await page.evaluate((f) => window.__foldify.setSelectedFace(f), face)
  await page.getByTestId('open-shape-editor').click()
  await expect(page.getByTestId('shape-editor')).toBeVisible()
}

/** click a point given in face pixels (0..1024) on the editor */
async function tap(page, x, y) {
  const box = await page.getByTestId('editor-overlay').boundingBox()
  const cx = box.x + (x / 1024) * box.width
  const cy = box.y + (y / 1024) * box.height
  await page.mouse.move(cx, cy)
  await page.mouse.down()
  await page.mouse.up()
}

async function drawClosed(page, points) {
  await page.getByTestId('tool-pen').click()
  for (const [x, y] of points) await tap(page, x, y)
  await tap(page, points[0][0], points[0][1]) // tap the first point again to close
}

test('library: add a shape, then delete it', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await openEditor(page, 'front')
  await page.getByTestId('tpl-star').click()
  let shapes = await shapesOf(page, 'front')
  expect(shapes).toHaveLength(1)
  expect(shapes[0]).toMatchObject({ type: 'star', x: 512, y: 512 })
  await page.getByTestId('delete-shape').click()
  shapes = await shapesOf(page, 'front')
  expect(shapes).toHaveLength(0)
})

test('draw your own: points snap to the grid and closing makes a filled shape', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await openEditor(page, 'left')
  // slightly off-grid taps land on the 64px grid
  await drawClosed(page, [[130, 650], [380, 645], [390, 900], [125, 890]])
  const [s] = await shapesOf(page, 'left')
  expect(s).toMatchObject({ type: 'path', closed: true, x: 256, y: 768, w: 256, h: 256 })
  expect(s.pts).toEqual([0, 0, 100, 0, 100, 100, 0, 100])
  // flat number list: Firestore cannot store arrays inside arrays
  expect(s.pts.every((v) => typeof v === 'number')).toBe(true)
})

test('lines join onto the corners of other shapes', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await openEditor(page, 'right')
  await drawClosed(page, [[192, 192], [448, 192], [448, 448]])
  // grid off, then start a line 14px away from a corner: it snaps onto the corner
  await page.getByRole('button', { name: /Snap to grid|ดูดเข้าตาราง/ }).click()
  await page.getByTestId('tool-pen').click()
  await tap(page, 460, 438)
  await tap(page, 800, 700)
  await page.getByTestId('pen-finish-line').click()
  const shapes = await shapesOf(page, 'right')
  expect(shapes).toHaveLength(2)
  const line = shapes[1]
  expect(line.closed).toBe(false)
  // first point of the new line, back in face pixels
  const x0 = line.x - line.w / 2 + (line.pts[0] / 100) * line.w
  const y0 = line.y - line.h / 2 + (line.pts[1] / 100) * line.h
  expect([Math.round(x0), Math.round(y0)]).toEqual([448, 448])
})

test('what you draw in the editor is what you see on the box (no mirroring)', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await openEditor(page, 'front')
  // four coloured squares in the corners, same layout as the orientation test's markers
  const corners = [
    // each covers the probe's sample point (96 px in from each corner)
    ['#ff0000', [[192, 192], [64, 192], [64, 64], [192, 64]]],
    ['#0000ff', [[832, 192], [832, 64], [960, 64], [960, 192]]],
    ['#00ff00', [[192, 832], [192, 960], [64, 960], [64, 832]]],
    ['#ffff00', [[832, 832], [960, 832], [960, 960], [832, 960]]],
  ]
  for (const [color, pts] of corners) {
    await page.getByTestId('tool-pen').click()
    for (const [x, y] of pts) await tap(page, x, y)
    await page.getByTestId('pen-close').click()
    await page.getByTestId('shape-editor').locator('input[type=color]').fill(color)
  }
  expect(await shapesOf(page, 'front')).toHaveLength(4)
  await page.keyboard.press('Escape') // deselect
  await page.keyboard.press('Escape') // close
  await expect(page.getByTestId('shape-editor')).toHaveCount(0)

  await page.evaluate(() => { const f = window.__foldify; f.setShowShadows(false); f.setShowGrid(false); f.setSelectedFace(null) })
  await installProbe(page)
  for (const fold of [0, 1]) {
    await page.evaluate((v) => window.__foldify.setFoldProgress(v), fold)
    await settle(page, 4)
    const front = (await page.evaluate(() => window.__foldify.inspectFaces())).find((f) => f.faceId === 'front')
    expect(front.seen, `fold ${fold}`).toEqual({ TL: 'red', TR: 'blue', BL: 'green', BR: 'yellow' })
  }
})

test('old stickers (square / circle / star) still load and draw', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await page.evaluate(() => window.__foldify.setFacesConfig((prev) => ({
    ...prev,
    back: { ...prev.back, shapes: [{ id: 1, type: 'star', x: 300, y: 300, scale: 2, rotation: 0, color: '#ff0000' }], activeShapeIndex: null },
  })))
  await openEditor(page, 'back')
  // the old sticker is selectable in the editor: tap its centre, then delete it
  await page.getByRole('radio', { name: /^(Select|เลือก)$/ }).click()
  await tap(page, 300, 300)
  await page.getByTestId('delete-shape').click()
  expect(await shapesOf(page, 'back')).toHaveLength(0)
})
