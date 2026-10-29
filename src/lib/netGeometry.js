// Pure geometry for cube nets — shared by the 3D renderer, the net picker,
// the Smart Scan analyzer and the automated tests.
//
// Conventions (2D, the flat net as it appears on paper / on screen from above):
//   x grows to the right, y grows DOWN (image coordinates).
//   Edge names are physical directions on the paper: top = up on the page.
//
// Conventions (3D, Three.js world):
//   The flat net lies on the floor, printed side facing +Y (up).
//   Paper right  -> world +X
//   Paper up     -> world -Z (away from the default camera)
//   When folded, the root face becomes the TOP of the cube and every other
//   face folds DOWN, so the printed side always ends up on the OUTSIDE.
//   Folded face directions: top +Y, bottom -Y, front +Z, back -Z, left -X, right +X.
//
// A "net transform" places one of the 11 canonical nets on the paper:
//   { rotation: 0..3 (clockwise quarter turns), flipX: bool, flipY: bool }
//   applied in the order flipX -> flipY -> rotation.
// Transforms only move WHERE the squares are. They never mirror the picture
// printed on a square — every square is always drawn upright on the paper.

import * as THREE from "three";

export const EDGES_CW = ["top", "right", "bottom", "left"];
export const FACE_IDS = ["top", "bottom", "front", "back", "left", "right"];

const EDGE_VEC = {
  top: [0, -1],
  right: [1, 0],
  bottom: [0, 1],
  left: [-1, 0],
};

export const IDENTITY_TRANSFORM = Object.freeze({ rotation: 0, flipX: false, flipY: false });

export function normalizeTransform(t = {}) {
  return {
    rotation: (((t.rotation ?? t.netRotation ?? 0) % 4) + 4) % 4,
    flipX: !!(t.flipX ?? t.netFlipX),
    flipY: !!(t.flipY ?? t.netFlipY),
  };
}

/** Map a logical edge of the canonical net to its physical edge on the paper. */
export function mapEdge(edge, transform) {
  const t = normalizeTransform(transform);
  let e = edge;
  if (t.flipX) e = e === "left" ? "right" : e === "right" ? "left" : e;
  if (t.flipY) e = e === "top" ? "bottom" : e === "bottom" ? "top" : e;
  return EDGES_CW[(EDGES_CW.indexOf(e) + t.rotation) % 4];
}

/**
 * Walk a net tree and return every square with its paper grid cell.
 * Each cell: { path, node, x, y, edge (physical edge to parent, null for root), parentPath }
 * Coordinates are normalised so the smallest x and y are 0.
 */
export function layoutNet(net, transform = IDENTITY_TRANSFORM) {
  const cells = [];
  const walk = (node, x, y, path, edge, parentPath) => {
    cells.push({ path, node, x, y, edge, parentPath });
    (node.children || []).forEach((child, i) => {
      const phys = mapEdge(child.edge, transform);
      const [dx, dy] = EDGE_VEC[phys];
      walk(child, x + dx, y + dy, `${path}.${i}`, phys, path);
    });
  };
  walk(net, 0, 0, "0", null, null);
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  cells.forEach((c) => {
    c.x -= minX;
    c.y -= minY;
  });
  const columns = Math.max(...cells.map((c) => c.x)) + 1;
  const rows = Math.max(...cells.map((c) => c.y)) + 1;
  return { cells, columns, rows };
}

/** Occupancy signature like "0100,1111,0100" (rows separated by commas). */
export function layoutSignature({ cells, columns, rows }) {
  const rowsOut = [];
  for (let y = 0; y < rows; y++) {
    let s = "";
    for (let x = 0; x < columns; x++) s += cells.some((c) => c.x === x && c.y === y) ? "1" : "0";
    rowsOut.push(s);
  }
  return rowsOut.join(",");
}

/** All 8 placements of a square net (4 rotations x optional mirror). */
export function allTransforms() {
  const out = [];
  for (const flipX of [false, true]) {
    for (let rotation = 0; rotation < 4; rotation++) out.push({ rotation, flipX, flipY: false });
  }
  return out;
}

/**
 * Hinge for a child attached on `edge` of its parent, in the parent's local
 * plane space (plane XY, +Z = printed side). Children always fold towards -Z
 * (behind the printed side) so the print stays on the outside of the box.
 */
export function hingeFor(edge, angle) {
  switch (edge) {
    case "top":
      return { offset: [0, 1, 0], rot: [-angle, 0, 0] };
    case "bottom":
      return { offset: [0, -1, 0], rot: [angle, 0, 0] };
    case "left":
      return { offset: [-1, 0, 0], rot: [0, -angle, 0] };
    case "right":
      return { offset: [1, 0, 0], rot: [0, angle, 0] };
    default:
      return { offset: [0, 0, 0], rot: [0, 0, 0] };
  }
}

/** Root placement of the whole net in the world. */
export function rootPlacement(foldProgress) {
  const angle = foldProgress * (Math.PI / 2);
  return {
    angle,
    // When fully folded the cube hangs 2 units below the root face — lift it so it sits on the floor.
    position: [0, 2 * Math.sin(angle), 0],
    // Plane XY -> world XZ with the printed side (+Z) facing up and paper-up facing -Z.
    rotation: [-Math.PI / 2, 0, 0],
  };
}

/**
 * Compute the world matrix of every face's plane for a given fold progress.
 * Mirrors exactly what Box.jsx renders. Returns Map(path -> THREE.Matrix4).
 */
export function faceWorldMatrices(net, transform, foldProgress) {
  const { angle, position, rotation } = rootPlacement(foldProgress);
  const result = new Map();
  const tmp = new THREE.Object3D();
  const mat = (pos, rot) => {
    tmp.position.set(...pos);
    tmp.rotation.set(...rot);
    tmp.scale.set(1, 1, 1);
    tmp.updateMatrix();
    return tmp.matrix.clone();
  };
  const root = mat(position, rotation);
  const walk = (node, parentMeshMatrix, path, physEdge) => {
    let meshMatrix;
    if (physEdge === null) {
      meshMatrix = parentMeshMatrix;
    } else {
      const h = hingeFor(physEdge, angle);
      // group(at hinge, rotated) -> mesh(offset again from hinge)
      const group = mat(h.offset, h.rot);
      const mesh = mat(h.offset, [0, 0, 0]);
      meshMatrix = parentMeshMatrix.clone().multiply(group).multiply(mesh);
    }
    result.set(path, meshMatrix);
    (node.children || []).forEach((child, i) =>
      walk(child, meshMatrix, `${path}.${i}`, mapEdge(child.edge, transform))
    );
  };
  walk(net, root, "0", null);
  return result;
}

const DIRECTION_OF = [
  ["right", new THREE.Vector3(1, 0, 0)],
  ["left", new THREE.Vector3(-1, 0, 0)],
  ["top", new THREE.Vector3(0, 1, 0)],
  ["bottom", new THREE.Vector3(0, -1, 0)],
  ["front", new THREE.Vector3(0, 0, 1)],
  ["back", new THREE.Vector3(0, 0, -1)],
];

export function directionName(vec) {
  let best = null;
  let bestDot = -Infinity;
  for (const [name, v] of DIRECTION_OF) {
    const d = v.dot(vec);
    if (d > bestDot) {
      bestDot = d;
      best = name;
    }
  }
  return best;
}

/** Outward normal (printed side) of a face plane given its world matrix. */
export function planeNormal(matrix) {
  return new THREE.Vector3(0, 0, 1).transformDirection(matrix);
}

/** World direction of the picture's "up" (local +Y) given a world matrix. */
export function planeUp(matrix) {
  return new THREE.Vector3(0, 1, 0).transformDirection(matrix);
}

const faceIdCache = new Map();

/**
 * Which side of the folded cube each square ends up on: Map(path -> faceId).
 * Face ids therefore always describe the real folded position, whatever
 * net / rotation / mirror is chosen.
 */
export function resolveFaceIds(net, transform) {
  const t = normalizeTransform(transform);
  const key = `${JSON.stringify(net)}|${t.rotation}|${t.flipX}|${t.flipY}`;
  if (faceIdCache.has(key)) return faceIdCache.get(key);
  const mats = faceWorldMatrices(net, t, 1);
  const ids = new Map();
  for (const [path, m] of mats) ids.set(path, directionName(planeNormal(m)));
  const unique = new Set(ids.values());
  if (unique.size !== 6) throw new Error(`Net does not fold into a cube (faces: ${[...ids.values()].join(",")})`);
  faceIdCache.set(key, ids);
  return ids;
}
