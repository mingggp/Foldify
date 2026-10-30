import { test, expect } from '@playwright/test'
import {
  ROTATIONS, DIRS, FLIP_VIEW, designCube, foldNet, rotateCube, sameCube, sameView, viewOf, turnUp, quarterOf,
  netToCubeQuestion, cubeToNetQuestion,
} from '../../src/lib/cubeQuiz.js'
import { VALID_CUBE_NETS } from '../../src/components/canvas/netsConfig.js'
import { allTransforms } from '../../src/lib/netGeometry.js'

// every face looks different and has no symmetry (like letters A–F)
const exact = (a, b) => a.key === b.key && a.k === b.k
// faces look the same whichever way they are turned (plain colours)
const turnless = (a, b) => a.key === b.key
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647)

test('24 different rotations; FLIP_VIEW is one of them', () => {
  expect(ROTATIONS).toHaveLength(24)
  expect(new Set(ROTATIONS.map((m) => JSON.stringify(m))).size).toBe(24)
  expect(ROTATIONS.map((m) => JSON.stringify(m))).toContain(JSON.stringify(FLIP_VIEW))
})

test('turning is clockwise seen from outside, and quarterOf undoes it', () => {
  // front face (normal +z, towards the viewer): up (+y) turned clockwise once points right (+x)
  expect(turnUp([0, 1, 0], [0, 0, 1], 1)).toEqual([1, 0, 0])
  for (const n of Object.values(DIRS)) {
    for (let k = 0; k < 4; k++) {
      const up = turnUp(n[1] === 0 ? [0, 1, 0] : [0, 0, -n[1]], n, k)
      expect(quarterOf(up, n)).toBe(k)
    }
  }
})

test('the design cube puts every face design on the side it is named after', () => {
  VALID_CUBE_NETS.forEach((_, netIndex) => {
    for (const transform of allTransforms()) {
      for (const f of designCube(netIndex, transform)) expect(f.n).toEqual(DIRS[f.key])
    }
  })
})

test('the flip view shows exactly the three faces the first view hides', () => {
  const cube = designCube(0, {})
  const a = viewOf(cube).map((s) => s.key)
  const b = viewOf(rotateCube(cube, FLIP_VIEW)).map((s) => s.key)
  expect(new Set([...a, ...b]).size).toBe(6)
})

test('net -> box: right choices are real views of the box, wrong ones are not', () => {
  for (let seed = 1; seed < 120; seed++) {
    const rnd = seeded(seed)
    const design = { netIndex: seed % 11, transform: allTransforms()[seed % 8] }
    const truth = designCube(design.netIndex, design.transform)
    const views = ROTATIONS.map((R) => viewOf(rotateCube(truth, R)))
    for (const mode of ['correct', 'different']) {
      const q = netToCubeQuestion(design, exact, mode, rnd)
      expect(q).not.toBeNull()
      expect(q.choices).toHaveLength(5)
      expect(q.choices.filter((c) => c.right)).toHaveLength(mode === 'correct' ? 1 : 4)
      for (const c of q.choices) expect(views.some((v) => sameView(v, c.view, exact))).toBe(c.right)
      expect(q.choices[q.answer].right).toBe(mode === 'correct')
    }
  }
})

test('wrong choices stay wrong when faces look the same turned', () => {
  for (let seed = 1; seed < 60; seed++) {
    const rnd = seeded(seed)
    const design = { netIndex: seed % 11, transform: {} }
    const truth = designCube(design.netIndex, design.transform)
    const views = ROTATIONS.map((R) => viewOf(rotateCube(truth, R)))
    const q = netToCubeQuestion(design, turnless, 'correct', rnd)
    expect(q).not.toBeNull()
    for (const c of q.choices.filter((x) => !x.right)) expect(views.some((v) => sameView(v, c.view, turnless))).toBe(false)
  }
})

test('no question when every face looks the same', () => {
  expect(netToCubeQuestion({ netIndex: 0, transform: {} }, () => true, 'correct', seeded(3))).toBeNull()
  expect(cubeToNetQuestion({ netIndex: 0, transform: {} }, () => true, 'correct', seeded(3))).toBeNull()
})

test('box -> net: right nets fold into the same box, wrong ones do not', () => {
  for (let seed = 1; seed < 80; seed++) {
    const rnd = seeded(seed)
    const design = { netIndex: seed % 11, transform: allTransforms()[(seed * 3) % 8] }
    const truth = designCube(design.netIndex, design.transform)
    for (const mode of ['correct', 'different']) {
      const q = cubeToNetQuestion(design, exact, mode, rnd)
      expect(q).not.toBeNull()
      expect(q.question.views).toHaveLength(2)
      expect(new Set(q.choices.map((c) => c.net.netIndex)).size).toBe(5) // five different net shapes
      for (const c of q.choices) {
        const folded = foldNet(c.net.netIndex, c.net.transform, (d, up, n, path) => c.net.cells.get(path)).cube
        expect(sameCube(folded, truth, exact)).toBe(c.right)
      }
      expect(q.choices[q.answer].right).toBe(mode === 'correct')
    }
  }
})
