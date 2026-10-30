import { test, expect } from '@playwright/test'
import { installProbe, setAllFaceTextures, settle } from './helpers.js'

test.use({ viewport: { width: 1280, height: 900 } })

const ready = (page) => page.waitForFunction(() => window.__foldify?.three && window.__foldify?.cubeQuiz, null, { timeout: 30_000 })

/** marker faces, each turned / mirrored differently, so any orientation slip shows up */
async function markerBox(page, netIndex, transform) {
  await page.evaluate(({ netIndex, transform }) => {
    const f = window.__foldify
    f.setShowShadows(false); f.setShowGrid(false); f.setSelectedFace(null)
    f.setActiveNetId(netIndex); f.setNetTransform(transform)
  }, { netIndex, transform })
  await installProbe(page)
  await setAllFaceTextures(page)
  await page.evaluate(() => window.__foldify.setFacesConfig((prev) => ({
    ...prev,
    front: { ...prev.front, rotation: 90, flipX: true },
    top: { ...prev.top, rotation: 180 },
    right: { ...prev.right, rotation: 270, flipY: true },
    left: { ...prev.left, rotation: 90 },
  })))
  await settle(page, 4)
}

// Draw with the quiz's 2D drawing code AND render the real 3D box with the same camera;
// sample the four corner markers of every visible face in both and compare colours.
const compare = (page, what) => page.evaluate(async (what) => {
  const f = window.__foldify, Q = f.cubeQuiz, { THREE, scene, gl } = f.three
  const s = f.state
  const transform = { rotation: s.netRotation, flipX: s.netFlipX, flipY: s.netFlipY }
  const images = await Q.faceImages(s.facesConfig, f.drawShapes)
  const W = 360
  const c2 = document.createElement('canvas'); c2.width = c2.height = W
  const ctx = c2.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, W)

  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
  const centre = new THREE.Vector3()
  const samples = [] // { world: Vector3, px2d: [x, y], name }
  const fr = 0.12 // marker centre: 24/256 of the picture in from each corner (plus margin)
  const corners = { TL: [fr, fr], TR: [1 - fr, fr], BL: [fr, 1 - fr], BR: [1 - fr, 1 - fr] }

  if (what === 'cube') {
    const truth = Q.designCube(s.activeNetId, transform)
    Q.drawCubeView(ctx, Q.viewOf(truth), images, W, W)
    centre.set(0, 1, 0)
    const half = 1.8 // drawCubeView: W / 3.6 px per unit
    Object.assign(cam, { left: -half, right: half, top: half, bottom: -half })
    cam.position.copy(centre).add(new THREE.Vector3(1, 1, 1).multiplyScalar(10))
    cam.up.set(0, 1, 0)
    cam.lookAt(centre)
    const EX = new THREE.Vector3(1, 0, -1).normalize(), EY = new THREE.Vector3(-1, 2, -1).normalize()
    for (const side of ['right', 'top', 'front']) {
      const face = truth.find((x) => Q.sideOf(x.n) === side)
      const n = new THREE.Vector3(...face.n), u = new THREE.Vector3(...face.u), r = u.clone().cross(n)
      for (const [name, [fx, fy]] of Object.entries(corners)) {
        const p = n.clone().addScaledVector(r, 2 * fx - 1).addScaledVector(u, 1 - 2 * fy)
        samples.push({ name: `${side}:${name}`, world: p.clone().add(centre), px2d: [W / 2 + p.dot(EX) * (W / 3.6), W / 2 - p.dot(EY) * (W / 3.6)] })
      }
    }
  } else {
    const net = { netIndex: s.activeNetId, transform, cells: null }
    Q.drawNet(ctx, net, images, W, W)
    // same layout maths as drawNet
    const { cells, columns, rows } = f.layoutNet(s.activeNetId, transform)
    const cell = Math.min(W / (columns + 0.4), W / (rows + 0.4))
    const ox = (W - columns * cell) / 2, oy = (W - rows * cell) / 2
    const root = cells.find((c) => c.parentPath == null)
    // flat net seen from straight above, paper-up = world -z
    const half = (W / cell) // world units per W px is 2 per cell
    centre.set(((columns / 2) - root.x - 0.5) * 2, 0, ((rows / 2) - root.y - 0.5) * 2)
    Object.assign(cam, { left: -half, right: half, top: half, bottom: -half })
    cam.position.copy(centre).add(new THREE.Vector3(0, 10, 0))
    cam.up.set(0, 0, -1)
    cam.lookAt(centre)
    for (const c of cells) {
      for (const [name, [fx, fy]] of Object.entries(corners)) {
        const world = new THREE.Vector3((c.x - root.x) * 2 + (2 * fx - 1), 0, (c.y - root.y) * 2 + (2 * fy - 1))
        samples.push({ name: `${c.path}:${name}`, world, px2d: [ox + (c.x + fx) * cell, oy + (c.y + fy) * cell] })
      }
    }
  }
  cam.updateProjectionMatrix(); cam.updateMatrixWorld(true)

  const rt = new THREE.WebGLRenderTarget(W, W)
  const buf = new Uint8Array(W * W * 4)
  scene.updateMatrixWorld(true)
  gl.setRenderTarget(rt); gl.setClearColor(0x808080, 1); gl.clear(); gl.render(scene, cam)
  gl.readRenderTargetPixels(rt, 0, 0, W, W, buf); gl.setRenderTarget(null); rt.dispose()

  const classify = ([r, g, b]) => {
    const named = { red: [255, 0, 0], blue: [0, 0, 255], green: [0, 255, 0], yellow: [255, 255, 0] }
    let best = 'other', bestD = 110 * 110 * 3
    for (const [k, [R, G, B]] of Object.entries(named)) { const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2; if (d < bestD) { bestD = d; best = k } }
    return best
  }
  const px2 = ctx.getImageData(0, 0, W, W).data
  return samples.map(({ name, world, px2d }) => {
    const p = world.clone().project(cam)
    const x3 = Math.round((p.x * 0.5 + 0.5) * (W - 1)), y3 = Math.round((p.y * 0.5 + 0.5) * (W - 1)) // RT rows are bottom-up
    const i3 = (y3 * W + x3) * 4
    const i2 = (Math.round(px2d[1]) * W + Math.round(px2d[0])) * 4
    return { name, in3d: classify([buf[i3], buf[i3 + 1], buf[i3 + 2]]), in2d: classify([px2[i2], px2[i2 + 1], px2[i2 + 2]]) }
  })
}, what)

for (const [netIndex, transform] of [[0, {}], [5, { rotation: 1 }], [9, { rotation: 2, flipX: true }]]) {
  test(`quiz pictures match the real 3D box (net ${netIndex + 1}, ${JSON.stringify(transform)})`, async ({ page }) => {
    await page.goto('/')
    await ready(page)
    await markerBox(page, netIndex, transform)

    await page.evaluate(() => window.__foldify.setFoldProgress(1))
    await settle(page, 4)
    const cube = await compare(page, 'cube')
    for (const s of cube) {
      expect(s.in3d, s.name).not.toBe('other')
      expect(s.in2d, s.name).toBe(s.in3d)
    }

    await page.evaluate(() => window.__foldify.setFoldProgress(0))
    await settle(page, 4)
    const net = await compare(page, 'net')
    expect(net).toHaveLength(24)
    for (const s of net) {
      expect(s.in3d, s.name).not.toBe('other')
      expect(s.in2d, s.name).toBe(s.in3d)
    }
  })
}

test('quiz dialog: answer, see the result, next question', async ({ page }) => {
  await page.goto('/?v=1&net=3&labels=ABCDEF&quiz=1')
  await ready(page)
  const dialog = page.getByTestId('quiz')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('radio', { name: 'Net → box' }).click()
  await dialog.getByRole('radio', { name: 'The right one' }).click()
  await expect(page.getByTestId('quiz-prompt')).toHaveAttribute('data-kind', 'net2cube')
  await expect(page.getByTestId('quiz-choice')).toHaveCount(5)
  await expect(page.locator('[data-testid=quiz-choice][data-right=true]')).toHaveCount(1)
  await page.locator('[data-testid=quiz-choice][data-right=true]').click()
  await expect(page.getByTestId('quiz-result')).toHaveAttribute('data-correct', 'true')
  await expect(page.getByTestId('quiz-score')).toContainText('1/1')

  await dialog.getByRole('radio', { name: 'Box → net' }).click()
  await dialog.getByRole('radio', { name: 'The odd one out' }).click()
  await expect(page.getByTestId('quiz-prompt')).toHaveAttribute('data-kind', 'cube2net')
  await expect(page.locator('[data-testid=quiz-choice][data-right=false]')).toHaveCount(1)
  // picking a net that DOES fold into the box is wrong in "odd one out" mode
  await page.locator('[data-testid=quiz-choice][data-right=true]').first().click()
  await expect(page.getByTestId('quiz-result')).toHaveAttribute('data-correct', 'false')
  await expect(page.getByTestId('quiz-score')).toContainText('1/2')
  await page.getByTestId('quiz-next').click()
  await expect(page.getByTestId('quiz-result')).toHaveCount(0)
})

test('a plain box falls back to a lettered practice net', async ({ page }) => {
  await page.goto('/')
  await ready(page)
  await page.getByTestId('open-quiz').click()
  await expect(page.getByTestId('quiz-prompt')).toBeVisible()
  await expect(page.getByTestId('quiz')).toContainText(/practice net|รูปคลี่ตัวอักษร/)
})
