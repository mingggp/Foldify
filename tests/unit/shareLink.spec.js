import { test, expect } from '@playwright/test'
import {
  buildShareLink, canonicalTransform, facesToLabels, labelsToFaces, paperOrder, parseLabels, parseShareLink, parseTurns,
} from '../../src/lib/shareLink.js'
import { layoutNet, layoutSignature, allTransforms } from '../../src/lib/netGeometry.js'
import { VALID_CUBE_NETS } from '../../src/components/canvas/netsConfig.js'
import { makeOppositeQuestion, randomPracticeNet, OPPOSITE } from '../../src/lib/quiz.js'

const BASE = 'https://foldify.example/'

test('labels: compact, comma separated, Thai, blanks', () => {
  expect(parseLabels('ABCDEF')).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
  expect(parseLabels('A1,B2,,_,E')).toEqual(['A1', 'B2', '', '', 'E', ''])
  // Thai: vowels/tone marks stay with their consonant
  expect(parseLabels('กิขคงจฉ')).toEqual(['กิ', 'ข', 'ค', 'ง', 'จ', 'ฉ'])
  expect(parseLabels('ABCDEFGH')).toHaveLength(6)
  expect(parseLabels('LONGWORD,B')[0]).toBe('LONG')
})

test('turns are clamped to quarter turns', () => {
  expect(parseTurns('0123')).toEqual([0, 1, 2, 3, 0, 0])
  expect(parseTurns('9x7')).toEqual([1, 3, 0, 0, 0, 0])
})

test('link round trip', () => {
  const state = { netIndex: 2, transform: { rotation: 1, flipX: true, flipY: false }, labels: ['ก', 'ข', '', 'ง', 'จ', 'ฉ'], turns: [0, 1, 0, 0, 3, 0], fold: 1, quiz: true }
  const url = buildShareLink(BASE, state)
  expect(url.startsWith(`${BASE}?v=1&net=3`)).toBe(true)
  const back = parseShareLink(new URL(url).search)
  expect(back).toEqual({ version: 1, ...state })
})

test('simple link stays short and readable', () => {
  const url = buildShareLink(BASE, { netIndex: 0, labels: ['A', 'B', 'C', 'D', 'E', 'F'] })
  expect(url).toBe(`${BASE}?v=1&net=1&labels=ABCDEF`)
})

test('box links', () => {
  expect(buildShareLink(BASE, { box: 'abc123' })).toBe(`${BASE}?v=1&box=abc123`)
  expect(parseShareLink('?v=1&box=abc123')).toEqual({ version: 1, box: 'abc123' })
  expect(parseShareLink('?box=../../x')).toBe(null)
})

test('bad or missing values never throw', () => {
  expect(parseShareLink('')).toBe(null)
  expect(parseShareLink('?foo=1')).toBe(null)
  const p = parseShareLink('?net=99&rot=-5&fold=500&labels=')
  expect(p.netIndex).toBe(10)
  expect(p.transform.rotation).toBe(0)
  expect(p.fold).toBe(1)
  expect(p.labels).toEqual(['', '', '', '', '', ''])
  expect(parseShareLink('?labels=AB').netIndex).toBe(0) // links without v / net still open
})

test('flipY-only and flipX+flipY are rewritten to the same paper shape', () => {
  VALID_CUBE_NETS.forEach((net) => {
    for (const t of [...allTransforms(), ...allTransforms().map((x) => ({ ...x, flipY: true }))]) {
      const c = canonicalTransform(t)
      expect(c.flipY).toBe(false)
      expect(layoutSignature(layoutNet(net, c))).toBe(layoutSignature(layoutNet(net, t)))
    }
  })
})

test('labels follow paper reading order (left→right, top→bottom)', () => {
  // Net 1 (cross):  . A .      -> back
  //                 B C D      -> left top right
  //                 . E .      -> front
  //                 . F .      -> bottom
  const { cells } = paperOrder(0, {})
  expect(cells.map((c) => [c.x, c.y])).toEqual([[1, 0], [0, 1], [1, 1], [2, 1], [1, 2], [1, 3]])
  const faces = labelsToFaces(0, {}, ['A', 'B', 'C', 'D', 'E', 'F'])
  expect(Object.fromEntries(Object.entries(faces).map(([k, v]) => [k, v.label])))
    .toEqual({ back: 'A', left: 'B', top: 'C', right: 'D', front: 'E', bottom: 'F' })
  expect(facesToLabels(0, {}, faces).labels).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
})

test('quiz: answer is always the opposite face, choices are the other 5', () => {
  let seed = 1
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  for (let i = 0; i < 200; i++) {
    const r = randomPracticeNet(rnd)
    const q = makeOppositeQuestion(r.faceLabels, rnd)
    expect(q.answerFaceId).toBe(OPPOSITE[q.faceId])
    expect(q.choices).toHaveLength(5)
    expect(q.choices.map((c) => c.faceId)).not.toContain(q.faceId)
    expect(q.choices.map((c) => c.faceId)).toContain(q.answerFaceId)
    expect(new Set(Object.values(r.faceLabels).map((l) => l.label)).size).toBe(6)
  }
})
