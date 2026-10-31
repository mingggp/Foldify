// Smart Scan regression test: "the same net photographed landscape vs portrait
// folded into different boxes".
//
// For every net in every paper placement we draw a synthetic "photo" (letters
// A-F, each with a magenta bar marking its top edge), rotate the photo by
// 0/90/180/270 degrees, scan it, load the result into the 3D net, and compare
// against the ideal box you'd get by folding that paper by hand:
//   * flat (0%): squares sit exactly where they are in the photo, bars point the same way
//   * folded (100%): same box as the ideal one up to turning it in your hands —
//     a mirror image is NOT accepted.

import { test, expect } from './fixtures.js'
import { openApp, installProbe } from './helpers.js'

test.use({ viewport: { width: 640, height: 400 } })

test.beforeEach(async ({ page }) => {
  await openApp(page)
  await installProbe(page)
})

for (let net = 0; net < 11; net++) {
  test(`scan -> 3D matches the paper: net ${net + 1}, all placements x 4 photo rotations @exhaustive`, async ({ page }) => {
    const failures = await page.evaluate(async (netIndex) => {
      const f = window.__foldify
      const { THREE } = f.three
      const { analyzeNetCanvas } = await import('/src/utils/SmartNetAnalyzer.js')
      const G = await import('/src/lib/netGeometry.js')
      const { VALID_CUBE_NETS } = await import('/src/components/canvas/netsConfig.js')
      const raf = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
      // Wait until React has committed the state we asked for (the hook's state is refreshed after each commit)
      const until = async (pred) => {
        for (let i = 0; i < 200; i++) {
          if (pred(f.state)) return raf()
          await new Promise((r) => setTimeout(r, 5))
        }
        throw new Error('app did not update')
      }
      const LETTERS = 'ABCDEF'
      const PALE = ['#ffd6d6', '#d6ffd6', '#d6d6ff', '#fff3c4', '#f0d6ff', '#d6f7ff']
      const EDGE_WORLD = { top: [0, 0, -1], right: [1, 0, 0], bottom: [0, 0, 1], left: [-1, 0, 0] }
      const LOCAL = { top: [0, 1, 0], right: [1, 0, 0], bottom: [0, -1, 0], left: [-1, 0, 0] }
      const errors = []
      const near = (a, b) => a.distanceTo(b) < 1e-3

      const drawPaper = (layout) => {
        const S = 70
        const M = 50
        const c = document.createElement('canvas')
        c.width = layout.columns * S + 2 * M
        c.height = layout.rows * S + 2 * M
        const x = c.getContext('2d')
        x.fillStyle = '#ffffff'
        x.fillRect(0, 0, c.width, c.height)
        layout.cells.forEach((cell, i) => {
          const px = M + cell.x * S
          const py = M + cell.y * S
          x.fillStyle = PALE[i]
          x.fillRect(px, py, S, S)
          x.fillStyle = '#ff00ff'
          x.fillRect(px + S * 0.25, py + S * 0.06, S * 0.5, S * 0.08)
          x.fillStyle = '#111111'
          x.font = `bold ${S * 0.5}px sans-serif`
          x.textAlign = 'center'
          x.textBaseline = 'middle'
          x.fillText(LETTERS[i], px + S / 2, py + S * 0.58)
        })
        x.strokeStyle = '#000000'
        x.lineWidth = 3
        layout.cells.forEach((cell) => x.strokeRect(M + cell.x * S, M + cell.y * S, S, S))
        return c
      }
      const rotateCanvas = (src, k) => {
        const c = document.createElement('canvas')
        c.width = k % 2 ? src.height : src.width
        c.height = k % 2 ? src.width : src.height
        const x = c.getContext('2d')
        x.translate(c.width / 2, c.height / 2)
        x.rotate((k * Math.PI) / 2) // clockwise on screen
        x.drawImage(src, -src.width / 2, -src.height / 2)
        return c
      }
      const readSlice = async (url) => {
        const img = new Image()
        img.src = url
        await img.decode()
        const c = document.createElement('canvas')
        c.width = c.height = 100
        const x = c.getContext('2d', { willReadFrequently: true })
        x.drawImage(img, 0, 0, 100, 100)
        const px = (u, v) => Array.from(x.getImageData(u, v, 1, 1).data.slice(0, 3))
        const isMagenta = ([r, g, b]) => r > 200 && b > 200 && g < 90
        const bar = ['top', 'right', 'bottom', 'left'].filter((e) =>
          isMagenta({ top: px(50, 10), right: px(90, 50), bottom: px(50, 90), left: px(10, 50) }[e]))
        const fill = px(18, 30)
        const hex = fill.map((v) => v.toString(16).padStart(2, '0')).join('')
        // nearest pale colour -> letter
        let best = -1
        let bestD = Infinity
        PALE.forEach((p, i) => {
          const rgb = [1, 3, 5].map((o) => parseInt(p.slice(o, o + 2), 16))
          const d = rgb.reduce((s, v, j) => s + (v - fill[j]) ** 2, 0)
          if (d < bestD) { bestD = d; best = i }
        })
        return { letter: bestD < 900 ? LETTERS[best] : `?${hex}`, bar }
      }
      const faceMatrices = () => {
        f.three.scene.updateMatrixWorld(true)
        const out = {}
        for (const m of f.printMeshes()) out[m.userData.faceId] = m.matrixWorld.clone()
        return out
      }

      const net = VALID_CUBE_NETS[netIndex]
      const seen = new Set()
      for (const placement of G.allTransforms()) {
        const layout = G.layoutNet(net, placement)
        const sig = G.layoutSignature(layout)
        if (seen.has(sig)) continue
        seen.add(sig)

        // Ideal folded box: letters glued upright on the drawn squares
        const idealMats = G.faceWorldMatrices(net, placement, 1)
        const ideal = {}
        layout.cells.forEach((cell, i) => {
          const m = idealMats.get(cell.path)
          ideal[LETTERS[i]] = { n: G.planeNormal(m), b: G.planeUp(m) }
        })

        for (let k = 0; k < 4; k++) {
          const tag = `net ${netIndex + 1} placement ${JSON.stringify(placement)} photo rotated ${k * 90}°`
          const photo = rotateCanvas(drawPaper(layout), k)
          let scan
          try {
            scan = await analyzeNetCanvas(photo)
          } catch (e) {
            errors.push(`${tag}: scan failed: ${e.message}`)
            continue
          }
          if (scan.activeNetId !== netIndex) errors.push(`${tag}: detected net ${scan.activeNetId + 1}`)

          // What's printed on each extracted face (letter + which side its bar is on)
          const slices = {}
          for (const [faceId, url] of Object.entries(scan.extractedFaces)) slices[faceId] = await readSlice(url)
          const photoBar = G.EDGES_CW[k] // bars all point here in the rotated photo
          for (const [faceId, s] of Object.entries(slices)) {
            if (s.bar.length !== 1 || s.bar[0] !== photoBar) errors.push(`${tag}: face ${faceId} slice bar ${s.bar} (expected ${photoBar}) — slice was flipped/transposed`)
          }

          // Load the detected net + placement into the app. (Pictures aren't needed for the
          // geometry check: which picture lands on which face comes from scan.extractedFaces.)
          f.setActiveNetId(scan.activeNetId)
          f.setNetTransform({ rotation: scan.netRotation, flipX: scan.netFlipX, flipY: scan.netFlipY })

          // ---- flat: same arrangement as the photo ----
          f.setFoldProgress(0)
          await until((st) => st.foldProgress === 0 && st.activeNetId === scan.activeNetId && st.netRotation === scan.netRotation &&
            st.netFlipX === scan.netFlipX && st.netFlipY === scan.netFlipY)
          const flat = faceMatrices()
          const photoCell = {} // letter -> rotated photo grid cell
          layout.cells.forEach((cell, i) => {
            let { x, y } = cell
            let cols = layout.columns
            let rows = layout.rows
            for (let r = 0; r < k; r++) { [x, y] = [rows - 1 - y, x]; [cols, rows] = [rows, cols] }
            photoCell[LETTERS[i]] = [x, y]
          })
          const flatPos = {}
          for (const [faceId, m] of Object.entries(flat)) {
            const p = new THREE.Vector3().setFromMatrixPosition(m)
            flatPos[slices[faceId].letter] = [p.x / 2, p.z / 2]
            const barWorld = new THREE.Vector3(...LOCAL[slices[faceId].bar[0] || 'top']).transformDirection(m)
            if (!near(barWorld, new THREE.Vector3(...EDGE_WORLD[photoBar]))) errors.push(`${tag}: flat face ${faceId} bar points the wrong way`)
          }
          const minX = Math.min(...Object.values(flatPos).map((p) => p[0]))
          const minZ = Math.min(...Object.values(flatPos).map((p) => p[1]))
          for (const L of LETTERS) {
            const got = flatPos[L] ? [Math.round(flatPos[L][0] - minX), Math.round(flatPos[L][1] - minZ)] : null
            if (!got || got[0] !== photoCell[L][0] || got[1] !== photoCell[L][1]) errors.push(`${tag}: letter ${L} flat at ${got} but photo has it at ${photoCell[L]}`)
          }

          // ---- folded: congruent to the ideal box (rotation allowed, mirror not) ----
          f.setFoldProgress(1)
          await until((st) => st.foldProgress === 1)
          const folded = faceMatrices()
          const actual = {}
          for (const [faceId, m] of Object.entries(folded)) {
            const s = slices[faceId]
            actual[s.letter] = { n: G.planeNormal(m), b: new THREE.Vector3(...LOCAL[s.bar[0] || 'top']).transformDirection(m) }
          }
          const basis = ({ n, b }) => new THREE.Matrix4().makeBasis(b, n.clone().cross(b), n)
          if (!actual.A) { errors.push(`${tag}: letter A missing`); continue }
          const R = basis(actual.A).multiply(basis(ideal.A).clone().transpose())
          for (const L of LETTERS) {
            if (!actual[L]) { errors.push(`${tag}: letter ${L} missing on the box`); continue }
            const n = ideal[L].n.clone().transformDirection(R)
            const b = ideal[L].b.clone().transformDirection(R)
            if (!near(n, actual[L].n) || !near(b, actual[L].b)) errors.push(`${tag}: letter ${L} is not where folding the paper would put it (mirror image / wrong face)`)
          }
        }
      }
      return errors
    }, net)
    expect(failures).toEqual([])
  })
}

test('a photo that is not a cube net is rejected with a clear message', async ({ page }) => {
  const message = await page.evaluate(async () => {
    const { analyzeNetCanvas } = await import('/src/utils/SmartNetAnalyzer.js')
    const c = document.createElement('canvas')
    c.width = 400
    c.height = 200
    const x = c.getContext('2d')
    x.fillStyle = '#fff'
    x.fillRect(0, 0, 400, 200)
    x.strokeStyle = '#000'
    x.lineWidth = 3
    for (let i = 0; i < 4; i++) x.strokeRect(40 + i * 70, 60, 70, 70) // only 4 squares
    try { await analyzeNetCanvas(c); return 'accepted' } catch (e) { return e.message }
  })
  expect(message).not.toBe('accepted')
})

test('the same sheet photographed landscape and portrait gives the same box (net 3)', async ({ page }) => {
  // Small readable version of the bug report, on top of the exhaustive test above.
  const same = await page.evaluate(async () => {
    const { analyzeNetCanvas } = await import('/src/utils/SmartNetAnalyzer.js')
    const G = await import('/src/lib/netGeometry.js')
    const { VALID_CUBE_NETS } = await import('/src/components/canvas/netsConfig.js')
    const layout = G.layoutNet(VALID_CUBE_NETS[2], {})
    const c = document.createElement('canvas')
    c.width = layout.columns * 80 + 100
    c.height = layout.rows * 80 + 100
    const x = c.getContext('2d')
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height)
    x.strokeStyle = '#000'; x.lineWidth = 3
    layout.cells.forEach((cell) => x.strokeRect(50 + cell.x * 80, 50 + cell.y * 80, 80, 80))
    const r = document.createElement('canvas')
    r.width = c.height; r.height = c.width
    const y = r.getContext('2d')
    y.translate(r.width / 2, r.height / 2); y.rotate(Math.PI / 2); y.drawImage(c, -c.width / 2, -c.height / 2)
    const a = await analyzeNetCanvas(c)
    const b = await analyzeNetCanvas(r)
    return { a: [a.activeNetId, a.netRotation, a.netFlipX], b: [b.activeNetId, b.netRotation, b.netFlipX] }
  })
  expect(same.a[0]).toBe(2)
  expect(same.b[0]).toBe(2)
  expect(same.b[2], 'a rotated photo must not be treated as a mirror image').toBe(same.a[2])
})

test('Smart Scan button in the sidebar loads a rotated photo into the 3D net', async ({ page }, testInfo) => {
  // Net 4 photographed sideways (rotated 90°) with letters
  const png = await page.evaluate(async () => {
    const G = await import('/src/lib/netGeometry.js')
    const { VALID_CUBE_NETS } = await import('/src/components/canvas/netsConfig.js')
    const layout = G.layoutNet(VALID_CUBE_NETS[3], {})
    const S = 90
    const c = document.createElement('canvas')
    c.width = layout.columns * S + 120
    c.height = layout.rows * S + 120
    const x = c.getContext('2d')
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height)
    x.font = 'bold 50px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'
    layout.cells.forEach((cell, i) => {
      x.fillStyle = '#111'; x.fillText('ABCDEF'[i], 60 + cell.x * S + S / 2, 60 + cell.y * S + S / 2)
      x.fillStyle = '#ff00ff'; x.fillRect(60 + cell.x * S + 25, 60 + cell.y * S + 8, 40, 8)
    })
    x.strokeStyle = '#000'; x.lineWidth = 3
    layout.cells.forEach((cell) => x.strokeRect(60 + cell.x * S, 60 + cell.y * S, S, S))
    const r = document.createElement('canvas')
    r.width = c.height; r.height = c.width
    const y = r.getContext('2d')
    y.translate(r.width / 2, r.height / 2); y.rotate(Math.PI / 2); y.drawImage(c, -c.width / 2, -c.height / 2)
    return r.toDataURL('image/png').split(',')[1]
  })
  await page.locator('input[type=file][accept="image/*"]').first().setInputFiles({ name: 'net.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') })
  await page.waitForFunction(() => window.__foldify.state.activeNetId === 3 && window.__foldify.state.facesConfig.top.textureUrl?.startsWith('data:image'), null, { timeout: 20_000 })
  const st = await page.evaluate(() => ({ rotation: window.__foldify.state.netRotation, flipX: window.__foldify.state.netFlipX }))
  expect(st.flipX, 'a rotated photo is not a mirror image').toBe(false)
  await page.evaluate(() => window.__foldify.setFoldProgress(0))
  await page.waitForTimeout(500)
  await testInfo.attach('scan-flat.png', { body: await page.screenshot(), contentType: 'image/png' })
})
