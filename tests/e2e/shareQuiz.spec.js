import { test, expect } from './fixtures.js'
import { installProbe, setAllFaceTextures, settle } from './helpers.js'

test.use({ viewport: { width: 1280, height: 800 } })

const ready = (page) => page.waitForFunction(() => window.__foldify?.three && window.__foldify?.state, null, { timeout: 60_000 })
const state = (page) => page.evaluate(() => {
  const s = window.__foldify.state
  return {
    faceLabels: s.faceLabels,
    rotations: Object.fromEntries(Object.entries(s.facesConfig).map(([k, v]) => [k, v.rotation])),
    hasPicture: Object.fromEntries(Object.entries(s.facesConfig).map(([k, v]) => [k, !!v.textureUrl])),
    net: s.activeNetId, rot: s.netRotation, flipX: s.netFlipX, fold: s.foldProgress,
  }
})

test('a worksheet link opens the right net with labels on the right squares', async ({ page }) => {
  await page.goto('/?v=1&net=1&labels=ABCDEF&turn=010000&fold=0')
  await ready(page)
  const s = await state(page)
  expect(s.net).toBe(0)
  // Net 1 in reading order: back, left, top, right, front, bottom
  expect(Object.fromEntries(Object.entries(s.faceLabels).map(([k, v]) => [k, v.label])))
    .toEqual({ back: 'A', left: 'B', top: 'C', right: 'D', front: 'E', bottom: 'F' })
  expect(s.rotations.left).toBe(90) // turn=0 1 0 0 0 0 -> second square turned once
  expect(Object.values(s.hasPicture).every(Boolean)).toBe(true)
})

test('a rotated / mirrored net from a link is laid out as written', async ({ page }) => {
  await page.goto('/?v=1&net=4&labels=ABCDEF&rot=1&flip=1&fold=100')
  await ready(page)
  const s = await state(page)
  expect([s.net, s.rot, s.flipX, s.fold]).toEqual([3, 1, true, 1])
})

test('face "turn" rotates the picture clockwise as seen from outside', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await page.evaluate(() => { const f = window.__foldify; f.setShowShadows(false); f.setShowGrid(false); f.setSelectedFace(null) })
  await installProbe(page)
  await setAllFaceTextures(page)
  await page.evaluate(() => window.__foldify.setFacesConfig((prev) => Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, { ...v, rotation: 90 }]))))
  await settle(page, 4)
  for (const fold of [0, 1]) {
    await page.evaluate((f) => window.__foldify.setFoldProgress(f), fold)
    await settle(page)
    const faces = await page.evaluate(() => window.__foldify.inspectFaces())
    // picture turned 90° clockwise: old bottom-left (green) is now top-left, old top-left (red) top-right
    for (const f of faces) expect(f.seen, `${f.faceId} fold ${fold}`).toEqual({ TL: 'green', TR: 'red', BL: 'yellow', BR: 'blue' })
  }
})

test('letters typed in Decorate are shared as a link that reopens the same box', async ({ page, context }) => {
  test.slow() // two pages with software WebGL on CI
  await page.goto('/')
  await ready(page)
  await page.evaluate(() => { window.__foldify.setActiveNetId(2); window.__foldify.setNetTransform({ rotation: 1 }) })
  await page.waitForFunction(() => window.__foldify.state.activeNetId === 2 && window.__foldify.state.netRotation === 1)
  await page.getByRole('radio', { name: 'Decorate' }).click()
  const letters = { top: 'ก', front: 'ข', left: 'ค', right: 'ง', back: 'จ', bottom: 'ฉ' }
  for (const [face, letter] of Object.entries(letters)) {
    await page.getByTestId(`face-chip-${face}`).click()
    await page.getByTestId('face-letter').fill(letter)
  }
  // turn the letter on the bottom face once
  await page.getByRole('button', { name: 'Turn right' }).click()
  await page.waitForFunction(() => window.__foldify.state.facesConfig.bottom.rotation === 90)
  const want = await state(page)
  expect(Object.fromEntries(Object.entries(want.faceLabels).map(([k, v]) => [k, v.label]))).toEqual(letters)

  await page.getByTestId('open-share').click()
  await page.getByTestId('share-quiz').check()
  await expect(page.getByTestId('share-qr')).toBeVisible()
  const link = await page.getByTestId('share-link').inputValue()
  expect(link).toContain('v=1')
  expect(link).toContain('net=3')
  expect(link).toContain('rot=1')
  expect(link).toMatch(/turn=[01]*1[01]*/)
  expect(link).toContain('quiz=1')

  await page.close() // one software-WebGL page at a time is plenty for a CI runner
  const other = await context.newPage()
  await other.goto(link)
  await ready(other)
  const opened = await state(other)
  expect(Object.fromEntries(Object.entries(opened.faceLabels).map(([k, v]) => [k, v.label]))).toEqual(letters)
  expect(opened.rotations).toEqual(want.rotations)
  expect([opened.net, opened.rot]).toEqual([2, 1])
  await expect(other.getByTestId('quiz')).toBeVisible() // opened straight into guess mode
})

test('Share "this box": a letters-only box gets a plain link at once', async ({ page }) => {
  await page.goto('/?v=1&net=2&labels=ABCDEF&turn=010000')
  await ready(page)
  await page.getByTestId('open-share').click()
  await expect(page.getByTestId('share-preview').locator('canvas')).toHaveCount(1)
  const link = await page.getByTestId('share-link').inputValue()
  expect(link).toContain('net=2')
  expect(link).toContain('labels=ABCDEF')
  expect(link).toContain('turn=010000')
  await expect(page.getByTestId('share-qr')).toBeVisible()
})

test('Share "this box": a box with colours or pictures asks to sign in (saved copy)', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await page.evaluate(() => window.__foldify.setFacesConfig((prev) => ({ ...prev, top: { ...prev.top, color: '#ffb238' } })))
  await page.getByTestId('open-share').click()
  await expect(page.getByTestId('share-signin')).toBeVisible()
  await expect(page.getByTestId('share-link')).toHaveCount(0)
  await page.getByTestId('share-signin').click()
  await expect(page.getByTestId('auth')).toBeVisible()
})

test('the app starts in Thai', async ({ browser }) => {
  const ctx = await browser.newContext() // no English fixture here
  const page = await ctx.newPage()
  await page.goto('/')
  await ready(page)
  await expect(page.getByTestId('open-quiz')).toContainText('ทายก่อนพับ')
  await expect(page.locator('html')).toHaveAttribute('lang', 'th')
  await ctx.close()
})
