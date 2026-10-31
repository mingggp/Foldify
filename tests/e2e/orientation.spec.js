// Regression test for "letters on the box come out mirror-image (R -> Я)".
//
// Every face gets a picture with a letter, a magenta "top edge" bar and coloured
// corners (TL red, TR blue, BL green, BR yellow). We then look at each face
// straight-on from OUTSIDE the box, holding the camera the way you'd hold the
// paper (picture-up = camera-up), and check the corners are where they belong.
// A mirrored face would show blue top-left, or nothing at all (back side culled).

import { test, expect } from './fixtures.js'
import { openApp, installProbe, setAllFaceTextures, settle } from './helpers.js'

const NETS = 11
test.use({ viewport: { width: 640, height: 400 } })
const PLACEMENTS = [0, 1, 2, 3].flatMap((rotation) => [false, true].map((flipX) => ({ rotation, flipX, flipY: false })))
const UPRIGHT = { TL: 'red', TR: 'blue', BL: 'green', BR: 'yellow' }
const DIRECTION = { top: [0, 1, 0], bottom: [0, -1, 0], front: [0, 0, 1], back: [0, 0, -1], left: [-1, 0, 0], right: [1, 0, 0] }

async function check(page, { fold }) {
  await page.evaluate((fold) => window.__foldify.setFoldProgress(fold), fold)
  await settle(page)
  return page.evaluate(() => window.__foldify.inspectFaces())
}

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await installProbe(page)
  await setAllFaceTextures(page)
})

test('flat net (0%): every picture upright and readable from above, for all 11 nets x 8 placements', async ({ page }) => {
  for (let net = 0; net < NETS; net++) {
    for (const t of PLACEMENTS) {
      await page.evaluate(([net, t]) => { window.__foldify.setActiveNetId(net); window.__foldify.setNetTransform(t) }, [net, t])
      const faces = await check(page, { fold: 0 })
      expect(faces, `net ${net + 1}`).toHaveLength(6)
      for (const f of faces) {
        const where = `net ${net + 1} ${JSON.stringify(t)} face ${f.faceId}`
        expect(f.normal, `${where}: printed side should face up`).toEqual([0, 1, 0])
        expect(f.up, `${where}: picture-up should point to the top of the page`).toEqual([0, 0, -1])
        expect(f.seen, `${where}: picture mirrored or hidden`).toEqual(UPRIGHT)
      }
    }
  }
})

test('folded box (100%): every face printed side out, never mirrored, for all 11 nets x 8 placements', async ({ page }) => {
  for (let net = 0; net < NETS; net++) {
    for (const t of PLACEMENTS) {
      await page.evaluate(([net, t]) => { window.__foldify.setActiveNetId(net); window.__foldify.setNetTransform(t) }, [net, t])
      const faces = await check(page, { fold: 1 })
      expect(new Set(faces.map((f) => f.faceId)).size, `net ${net + 1}`).toBe(6)
      for (const f of faces) {
        const where = `net ${net + 1} ${JSON.stringify(t)} face ${f.faceId}`
        expect(f.normal, `${where}: label must match the side it folds to`).toEqual(DIRECTION[f.faceId])
        expect(f.seen, `${where}: picture mirrored or hidden`).toEqual(UPRIGHT)
        // On screen: picture-right really is to the right of picture-left (no reflection)
        expect(f.screen.TR[0], where).toBeGreaterThan(f.screen.TL[0])
        expect(f.screen.TL[1], where).toBeGreaterThan(f.screen.BL[1])
      }
    }
  }
})

test('half folded (50%): outside shows the picture, inside shows plain paper', async ({ page }) => {
  await page.evaluate(() => { window.__foldify.setActiveNetId(0); window.__foldify.setNetTransform({}) })
  const faces = await check(page, { fold: 0.5 })
  for (const f of faces) expect(f.seen, f.faceId).toEqual(UPRIGHT)
  // Look at the 'front' flap from the inside (opposite its printed normal): no picture allowed.
  const inside = await page.evaluate(() => {
    const { scene, gl, THREE } = window.__foldify.three
    const mesh = window.__foldify.printMeshes().find((m) => m.userData.faceId === 'front')
    const m = mesh.matrixWorld
    const c = new THREE.Vector3().setFromMatrixPosition(m)
    const n = new THREE.Vector3(0, 0, 1).transformDirection(m)
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
    cam.position.copy(c).addScaledVector(n, -0.9) // just inside the box
    cam.up.set(0, 1, 0)
    cam.lookAt(c)
    const rt = new THREE.WebGLRenderTarget(64, 64)
    gl.setRenderTarget(rt); gl.render(scene, cam)
    const buf = new Uint8Array(64 * 64 * 4)
    gl.readRenderTargetPixels(rt, 0, 0, 64, 64, buf)
    gl.setRenderTarget(null); rt.dispose()
    // Plain paper is one flat colour; the picture (white + black letter) is not.
    let min = 255
    let max = 0
    for (let i = 0; i < buf.length; i += 4) {
      const l = 0.3 * buf[i] + 0.59 * buf[i + 1] + 0.11 * buf[i + 2]
      min = Math.min(min, l)
      max = Math.max(max, l)
    }
    return max - min
  })
  expect(inside, 'inside of the paper must be plain, not the (mirrored) picture').toBeLessThan(12)
})

test('screenshots for a human eye: letters flat and folded', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const f = window.__foldify
    f.setActiveNetId(0)
    f.setNetTransform({})
    f.setShowLabels(true)
  })
  await setAllFaceTextures(page, { top: 'R', bottom: 'G', front: 'F', back: 'K', left: 'J', right: 'P' })
  for (const fold of [0, 0.6, 1]) {
    await page.evaluate((fold) => window.__foldify.setFoldProgress(fold), fold)
    await settle(page, 6)
    const shot = await page.locator('canvas').first().screenshot()
    await testInfo.attach(`fold-${Math.round(fold * 100)}.png`, { body: shot, contentType: 'image/png' })
  }
})
