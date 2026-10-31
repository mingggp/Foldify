// Shared helpers for the 3D tests. Everything that touches three.js runs inside
// the page (through the dev-only window.__foldify hook).

export async function openApp(page) {
  await page.goto('/')
  await page.waitForFunction(() => window.__foldify?.three && window.__foldify?.setFoldProgress, null, { timeout: 30_000 })
  await page.evaluate(() => {
    const f = window.__foldify
    f.setShowShadows(false) // unlit materials -> exact texture colours
    f.setShowGrid(false)
    f.setShowLabels(false)
    f.setSelectedFace(null) // no pink selection tint while measuring colours
  })
  await settle(page)
}

/** Wait for React + R3F to commit and render a couple of frames. */
export async function settle(page, frames = 3) {
  await page.evaluate(
    (n) => new Promise((resolve) => {
      let left = n
      const tick = () => (--left <= 0 ? resolve() : requestAnimationFrame(tick))
      requestAnimationFrame(tick)
    }),
    frames,
  )
}

/**
 * Install the test helpers in the page:
 *  - makeTexture(letter, bg): 256px picture with the letter, a magenta bar along its top
 *    edge and four coloured corner markers (TL red, TR blue, BL green, BR yellow).
 *  - inspectFaces(opts): renders every face straight-on from OUTSIDE the box with the
 *    picture's own "up" as camera up, and reports which marker colour lands where.
 */
export async function installProbe(page) {
  await page.evaluate(() => {
    const f = window.__foldify
    f.makeTexture = (letter, bg = '#ffffff') => {
      const c = document.createElement('canvas')
      c.width = c.height = 256
      const x = c.getContext('2d')
      x.fillStyle = bg
      x.fillRect(0, 0, 256, 256)
      x.fillStyle = '#ff00ff'
      x.fillRect(64, 8, 128, 20) // "top edge" mark, like the teacher's sheets
      x.fillStyle = '#111111'
      x.font = 'bold 150px sans-serif'
      x.textAlign = 'center'
      x.textBaseline = 'middle'
      x.fillText(letter, 128, 140)
      const m = 48
      x.fillStyle = '#ff0000'; x.fillRect(0, 0, m, m)
      x.fillStyle = '#0000ff'; x.fillRect(256 - m, 0, m, m)
      x.fillStyle = '#00ff00'; x.fillRect(0, 256 - m, m, m)
      x.fillStyle = '#ffff00'; x.fillRect(256 - m, 256 - m, m, m)
      return c.toDataURL()
    }

    const classify = ([r, g, b]) => {
      const named = { red: [255, 0, 0], blue: [0, 0, 255], green: [0, 255, 0], yellow: [255, 255, 0], magenta: [255, 0, 255] }
      let best = 'other'
      let bestD = 90 * 90 * 3
      for (const [name, [R, G, B]] of Object.entries(named)) {
        const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2
        if (d < bestD) { bestD = d; best = name }
      }
      return best
    }

    f.printMeshes = () => {
      const out = []
      f.three.scene.traverse((o) => {
        if (o.isMesh && o.userData?.faceId && o.userData.role !== 'inside') out.push(o)
      })
      return out
    }

    // Render with our own camera into an offscreen target; independent of the orbit controls.
    f.inspectFaces = ({ size = 160 } = {}) => {
      const { scene, gl, THREE } = f.three
      scene.updateMatrixWorld(true)
      const rt = new THREE.WebGLRenderTarget(size, size)
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
      const buf = new Uint8Array(size * size * 4)
      const marker = 1 - 2 * (24 / 256) // marker centre in plane units (plane spans -1..1)
      const corners = { TL: [-marker, marker], TR: [marker, marker], BL: [-marker, -marker], BR: [marker, -marker] }
      const results = []
      for (const mesh of f.printMeshes()) {
        const m = mesh.matrixWorld
        const centre = new THREE.Vector3().setFromMatrixPosition(m)
        const normal = new THREE.Vector3(0, 0, 1).transformDirection(m)
        const up = new THREE.Vector3(0, 1, 0).transformDirection(m)
        cam.position.copy(centre).addScaledVector(normal, 6)
        cam.up.copy(up)
        cam.lookAt(centre)
        cam.updateMatrixWorld(true)
        gl.setRenderTarget(rt)
        gl.setClearColor(0x808080, 1)
        gl.clear()
        gl.render(scene, cam)
        gl.readRenderTargetPixels(rt, 0, 0, size, size, buf)
        gl.setRenderTarget(null)
        const seen = {}
        const screen = {}
        for (const [name, [lx, ly]] of Object.entries(corners)) {
          const p = new THREE.Vector3(lx, ly, 0).applyMatrix4(m).project(cam)
          const px = Math.round((p.x * 0.5 + 0.5) * (size - 1))
          const py = Math.round((p.y * 0.5 + 0.5) * (size - 1)) // render targets are bottom-up
          const i = (py * size + px) * 4
          seen[name] = classify([buf[i], buf[i + 1], buf[i + 2]])
          screen[name] = [px, py]
        }
        results.push({
          faceId: mesh.userData.faceId,
          normal: normal.toArray().map((v) => Math.round(v * 1000) / 1000 + 0),
          up: up.toArray().map((v) => Math.round(v * 1000) / 1000 + 0),
          centre: centre.toArray().map((v) => Math.round(v * 1000) / 1000 + 0),
          seen,
          screen,
        })
      }
      rt.dispose()
      return results
    }
  })
}

export async function setAllFaceTextures(page, letters = { top: 'T', bottom: 'B', front: 'F', back: 'K', left: 'L', right: 'R' }) {
  await page.evaluate(async (letters) => {
    const f = window.__foldify
    f.setFacesConfig((prev) => {
      const next = { ...prev }
      for (const [id, letter] of Object.entries(letters)) next[id] = { ...next[id], textureUrl: f.makeTexture(letter), rotation: 0, flipX: false, flipY: false, shapes: [] }
      return next
    })
    // give the <img> elements a moment to decode
    await new Promise((r) => setTimeout(r, 150))
  }, letters)
  await settle(page, 4)
}
