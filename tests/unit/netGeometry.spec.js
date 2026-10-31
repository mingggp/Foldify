import { test, expect } from '@playwright/test'
import * as THREE from 'three'
import { VALID_CUBE_NETS } from '../../src/components/canvas/netsConfig.js'
import {
  FACE_IDS, allTransforms, faceWorldMatrices, layoutNet, layoutSignature, mapEdge,
  planeNormal, planeUp, resolveFaceIds,
} from '../../src/lib/netGeometry.js'

const OPPOSITE = { top: 'bottom', bottom: 'top', front: 'back', back: 'front', left: 'right', right: 'left' }

test('every net in every placement folds into a closed cube', () => {
  VALID_CUBE_NETS.forEach((net, i) => {
    for (const t of allTransforms()) {
      const mats = faceWorldMatrices(net, t, 1)
      const ids = resolveFaceIds(net, t)
      expect(new Set(ids.values()), `net ${i + 1} ${JSON.stringify(t)}`).toEqual(new Set(FACE_IDS))
      // every face sits on the surface of the 2x2x2 cube [-1,1]x[0,2]x[-1,1] and points outward
      for (const [path, m] of mats) {
        const c = new THREE.Vector3().setFromMatrixPosition(m)
        const n = planeNormal(m)
        const centre = new THREE.Vector3(0, 1, 0)
        expect(c.clone().sub(centre).normalize().dot(n), `net ${i + 1} face ${path} must face outward`).toBeGreaterThan(0.999)
        expect(c.distanceTo(centre)).toBeCloseTo(1, 5)
      }
    }
  })
})

test('face ids written in netsConfig.js match where each face really folds', () => {
  VALID_CUBE_NETS.forEach((net, i) => {
    const ids = resolveFaceIds(net, {})
    for (const cell of layoutNet(net).cells) {
      expect(ids.get(cell.path), `net ${i + 1}`).toBe(cell.node.id)
    }
  })
})

test('opposite faces are never adjacent on the flat net', () => {
  VALID_CUBE_NETS.forEach((net, i) => {
    for (const t of allTransforms()) {
      const ids = resolveFaceIds(net, t)
      for (const cell of layoutNet(net, t).cells) {
        if (!cell.parentPath) continue
        expect(OPPOSITE[ids.get(cell.path)], `net ${i + 1}`).not.toBe(ids.get(cell.parentPath))
      }
    }
  })
})

test('flat net is laid out exactly like the paper and never mirrored', () => {
  VALID_CUBE_NETS.forEach((net) => {
    for (const t of allTransforms()) {
      const mats = faceWorldMatrices(net, t, 0)
      const { cells } = layoutNet(net, t)
      const root = cells[0]
      const rootPos = new THREE.Vector3().setFromMatrixPosition(mats.get('0'))
      for (const cell of cells) {
        const m = mats.get(cell.path)
        const p = new THREE.Vector3().setFromMatrixPosition(m)
        // paper x -> world +X, paper y (down) -> world +Z (towards the viewer)
        expect(p.x - rootPos.x).toBeCloseTo((cell.x - root.x) * 2, 5)
        expect(p.z - rootPos.z).toBeCloseTo((cell.y - root.y) * 2, 5)
        // printed side up, picture-up pointing to the top of the page (-Z), picture-right to +X
        expect(planeNormal(m).y).toBeCloseTo(1, 5)
        expect(planeUp(m).z).toBeCloseTo(-1, 5)
        expect(new THREE.Vector3(1, 0, 0).transformDirection(m).x).toBeCloseTo(1, 5)
        expect(m.determinant()).toBeGreaterThan(0)
      }
    }
  })
})

test('the 64 paper placements of the 11 nets are all different shapes', () => {
  const owner = new Map()
  VALID_CUBE_NETS.forEach((net, i) => {
    for (const t of allTransforms()) {
      const sig = layoutSignature(layoutNet(net, t))
      if (owner.has(sig)) expect(owner.get(sig)).toBe(i)
      owner.set(sig, i)
    }
  })
  expect(owner.size).toBe(64)
})

test('edge mapping: rotate clockwise and mirror', () => {
  expect(mapEdge('top', { rotation: 1 })).toBe('right')
  expect(mapEdge('left', { rotation: 1 })).toBe('top')
  expect(mapEdge('left', { rotation: 3 })).toBe('bottom')
  expect(mapEdge('left', { flipX: true })).toBe('right')
  expect(mapEdge('top', { flipY: true, rotation: 2 })).toBe('top')
})
