// Exam-style "guess before folding" questions built from the user's own box.
//
//   net  -> cube : the question is the flat net, the 5 choices are folded boxes (3 faces seen)
//   cube -> net  : the question is the box seen from two sides, the 5 choices are nets
//   mode "correct"  : 1 choice is right, 4 are wrong   ("which one is it?")
//   mode "different": 4 choices are right, 1 is wrong  ("which one does not match?")
//
// Faces are compared by how they LOOK (small pixel signatures), not by id, so a face that
// looks the same turned (a plain colour, a circle, the letter O) can never make a "wrong"
// choice that is actually right.
//
// Geometry: world y is up; the folded box is the one Box.jsx draws (netGeometry.js).
// A face on the box = { key, n, u }: key = which face design (facesConfig key),
// n = outward normal, u = which way the picture's top points. All integer vectors.

import { VALID_CUBE_NETS } from "../components/canvas/netsConfig";
import { allTransforms, directionName, faceWorldMatrices, layoutNet, planeNormal, planeUp, resolveFaceIds } from "./netGeometry";

// ---------- integer vector helpers ----------
const r0 = (x) => Math.round(x) + 0;
const vec = (v) => [r0(v.x), r0(v.y), r0(v.z)];
const eqv = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const neg = (a) => a.map((x) => -x + 0);
const mul = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2] + 0);

export const DIRS = {
  right: [1, 0, 0], left: [-1, 0, 0], top: [0, 1, 0], bottom: [0, -1, 0], front: [0, 0, 1], back: [0, 0, -1],
};
const dirName = (n) => Object.keys(DIRS).find((k) => eqv(DIRS[k], n));

/** "picture top" we call 0 turns, for each side of the box */
const CANON = { right: [0, 1, 0], left: [0, 1, 0], front: [0, 1, 0], back: [0, 1, 0], top: [0, 0, -1], bottom: [0, 0, 1] };

/** turn an up-vector q quarter turns CLOCKWISE as seen from outside the face (normal n) */
export function turnUp(u, n, q) {
  let v = u;
  for (let i = 0; i < ((q % 4) + 4) % 4; i++) v = neg(cross(n, v)); // -90° about n
  return v.map((x) => x + 0);
}
/** how many clockwise quarter turns the picture is from the side's "canonical" top */
export function quarterOf(u, n) {
  const c = CANON[dirName(n)];
  for (let k = 0; k < 4; k++) if (eqv(turnUp(c, n, k), u)) return k;
  throw new Error("up vector not in the face plane");
}

/** all 24 rotations of a cube as integer 3x3 matrices */
export const ROTATIONS = (() => {
  const out = [];
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
  for (const p of perms) {
    for (let s = 0; s < 8; s++) {
      const M = [0, 1, 2].map((r) => [0, 0, 0].map((_, c) => (c === p[r] ? ((s >> r) & 1 ? -1 : 1) : 0)));
      const det =
        M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
        M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
        M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
      if (det === 1) out.push(M);
    }
  }
  return out;
})();
/** half turn about (1,-1,0): shows the three faces the iso view hides */
export const FLIP_VIEW = [[0, -1, 0], [-1, 0, 0], [0, 0, -1]];

export const rotateCube = (cube, M) => cube.map((f) => ({ ...f, n: mul(M, f.n), u: mul(M, f.u) }));

/**
 * Fold a net. content(dirName, localUp, normal, path) -> { key, q } says which face design goes on the
 * square that ends up on side dirName, and how many extra quarter turns it gets.
 * Returns { cube: [{key,n,u}], cells: Map(path -> {key, q}) }.
 */
export function foldNet(netIndex, transform, content) {
  const net = VALID_CUBE_NETS[netIndex];
  const mats = faceWorldMatrices(net, transform, 1);
  const cube = [];
  const cells = new Map();
  for (const [path, m] of mats) {
    const n = vec(planeNormal(m));
    const up = vec(planeUp(m));
    const { key, q } = content(directionName(planeNormal(m)), up, n, path);
    cells.set(path, { key, q });
    cube.push({ key, n, u: turnUp(up, n, q) });
  }
  return { cube, cells };
}

/** the user's own box: each face design sits on the side it is named after */
export const designCube = (netIndex, transform) => foldNet(netIndex, transform, (d) => ({ key: d, q: 0 })).cube;

/** the three faces seen in the standard view (from front-right-top) */
export function viewOf(cube) {
  return ["right", "top", "front"].map((side) => {
    const f = cube.find((x) => eqv(x.n, DIRS[side]));
    return { side, key: f.key, k: quarterOf(f.u, f.n) };
  });
}
const allSides = (cube) =>
  Object.keys(DIRS).map((side) => {
    const f = cube.find((x) => eqv(x.n, DIRS[side]));
    return { side, key: f.key, k: quarterOf(f.u, f.n) };
  });

/** look(a, b): do two (key, k) faces look the same? */
export const sameView = (a, b, look) => a.every((s, i) => look(s, b[i]));
export const sameCube = (A, B, look) => {
  const b = allSides(B);
  return ROTATIONS.some((R) => sameView(allSides(rotateCube(A, R)), b, look));
};

// ---------- random helpers ----------
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
function shuffle(arr, rnd) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- question makers ----------

/** Net -> 5 box views. Returns null if the faces are too alike to make wrong choices. */
export function netToCubeQuestion(design, look, mode, rnd = Math.random) {
  const truth = designCube(design.netIndex, design.transform);
  const valid = [];
  for (const R of shuffle(ROTATIONS, rnd)) {
    const v = viewOf(rotateCube(truth, R));
    if (!valid.some((w) => sameView(w, v, look))) valid.push(v);
  }
  const isValid = (v) => valid.some((w) => sameView(w, v, look));
  const opposite = (key) => {
    const f = truth.find((x) => x.key === key);
    return truth.find((x) => eqv(x.n, neg(f.n))).key;
  };

  const wrong = [];
  for (let tries = 0; tries < 400 && wrong.length < 4; tries++) {
    const base = pick(valid, rnd).map((s) => ({ ...s }));
    const kind = pick(["turn", "turn", "swap", "opposite"], rnd);
    const i = Math.floor(rnd() * 3);
    if (kind === "turn") base[i].k = (base[i].k + 1 + Math.floor(rnd() * 3)) % 4;
    else if (kind === "swap") {
      const j = (i + 1 + Math.floor(rnd() * 2)) % 3;
      [base[i].key, base[j].key] = [base[j].key, base[i].key];
    } else {
      const j = (i + 1 + Math.floor(rnd() * 2)) % 3;
      base[i].key = opposite(base[j].key); // two opposite faces shown side by side: impossible
      base[i].k = Math.floor(rnd() * 4);
    }
    if (!isValid(base) && !wrong.some((w) => sameView(w, base, look))) wrong.push(base);
  }

  const nRight = mode === "correct" ? 1 : 4;
  const nWrong = 5 - nRight;
  if (valid.length < nRight || wrong.length < nWrong) return null;
  const choices = shuffle([
    ...valid.slice(0, nRight).map((view) => ({ view, right: true })),
    ...wrong.slice(0, nWrong).map((view) => ({ view, right: false })),
  ], rnd);
  return {
    kind: "net2cube",
    mode,
    question: { net: { netIndex: design.netIndex, transform: design.transform, cells: null } },
    choices,
    answer: choices.findIndex((c) => (mode === "correct" ? c.right : !c.right)),
  };
}

const NET_PLACEMENTS = VALID_CUBE_NETS.flatMap((_, netIndex) => allTransforms().map((transform) => ({ netIndex, transform })));

/** a net (random shape) that folds into exactly `target` */
function netFor(target, netIndex, transform) {
  return foldNet(netIndex, transform, (d, up, n) => {
    const f = target.find((x) => eqv(x.n, n));
    for (let q = 0; q < 4; q++) if (eqv(turnUp(up, n, q), f.u)) return { key: f.key, q };
    throw new Error("cannot orient face");
  });
}

/** Box (two views) -> 5 nets. Returns null if the faces are too alike to make wrong choices. */
export function cubeToNetQuestion(design, look, mode, rnd = Math.random) {
  const truth = designCube(design.netIndex, design.transform);
  const shown = rotateCube(truth, pick(ROTATIONS, rnd));
  const nRight = mode === "correct" ? 1 : 4;
  const nWrong = 5 - nRight;
  const shapes = shuffle(VALID_CUBE_NETS.map((_, i) => i), rnd).slice(0, 5); // 5 different net shapes
  const choices = [];
  shapes.forEach((netIndex, i) => {
    const transform = pick(allTransforms(), rnd);
    const right = i < nRight;
    if (right) {
      const { cells } = netFor(rotateCube(truth, pick(ROTATIONS, rnd)), netIndex, transform);
      choices.push({ net: { netIndex, transform, cells }, right: true });
      return;
    }
    for (let tries = 0; tries < 200; tries++) {
      const { cells } = netFor(rotateCube(truth, pick(ROTATIONS, rnd)), netIndex, transform);
      const paths = [...cells.keys()];
      const a = pick(paths, rnd);
      if (rnd() < 0.5) {
        const b = pick(paths.filter((p) => p !== a), rnd);
        const ca = cells.get(a);
        cells.set(a, cells.get(b));
        cells.set(b, ca);
      } else {
        const c = cells.get(a);
        cells.set(a, { ...c, q: (c.q + 1 + Math.floor(rnd() * 3)) % 4 });
      }
      const folded = foldNet(netIndex, transform, (d, up, n, path) => cells.get(path)).cube;
      if (!sameCube(folded, truth, look)) {
        choices.push({ net: { netIndex, transform, cells }, right: false });
        return;
      }
    }
  });
  if (choices.length < 5 || choices.filter((c) => !c.right).length < nWrong) return null;
  const mixed = shuffle(choices, rnd);
  return {
    kind: "cube2net",
    mode,
    question: { views: [viewOf(shown), viewOf(rotateCube(shown, FLIP_VIEW))] },
    choices: mixed,
    answer: mixed.findIndex((c) => (mode === "correct" ? c.right : !c.right)),
  };
}

// ---------- pictures ----------

const imageCache = new Map();
const loadImage = (url) => {
  if (!imageCache.has(url)) {
    imageCache.set(url, new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    }));
  }
  return imageCache.get(url);
};

/**
 * One canvas per face design, as the face looks on its square (colour, picture, shapes,
 * then the face's own turn / mirror — same order as the 3D texture).
 */
export async function faceImages(facesConfig, drawShapes, size = 256) {
  const out = {};
  for (const [key, f] of Object.entries(facesConfig)) {
    const base = document.createElement("canvas");
    base.width = base.height = size;
    const b = base.getContext("2d", { willReadFrequently: true }); // CPU canvases: reading pixels back stays cheap
    b.fillStyle = f.color || "#ffffff";
    b.fillRect(0, 0, size, size);
    const img = f.textureUrl ? await loadImage(f.textureUrl) : null;
    if (img) b.drawImage(img, 0, 0, size, size);
    if (f.shapes?.length) {
      b.save();
      b.scale(size / 1024, size / 1024);
      drawShapes(b, f.shapes);
      b.restore();
    }
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    ctx.translate(size / 2, size / 2);
    ctx.rotate(((f.rotation || 0) * Math.PI) / 180);
    ctx.scale(f.flipX ? -1 : 1, f.flipY ? -1 : 1);
    ctx.drawImage(base, -size / 2, -size / 2);
    out[key] = c;
  }
  return out;
}

/** tiny signatures of each face in its 4 turns (rotated in JS: one pixel read per face), and a look(a, b) comparer */
export function makeLook(images, res = 12) {
  const sigs = {};
  const c = document.createElement("canvas");
  c.width = c.height = res;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  const turn = (px) => { // rotate a res x res RGBA array 90° clockwise
    const out = new Uint8ClampedArray(px.length);
    for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
      const from = (y * res + x) * 4, to = (x * res + (res - 1 - y)) * 4;
      out[to] = px[from]; out[to + 1] = px[from + 1]; out[to + 2] = px[from + 2]; out[to + 3] = px[from + 3];
    }
    return out;
  };
  for (const [key, img] of Object.entries(images)) {
    ctx.clearRect(0, 0, res, res);
    ctx.drawImage(img, 0, 0, res, res);
    const k0 = ctx.getImageData(0, 0, res, res).data;
    const k1 = turn(k0), k2 = turn(k1), k3 = turn(k2);
    sigs[key] = [k0, k1, k2, k3];
  }
  const close = (a, b) => {
    let d = 0;
    for (let i = 0; i < a.length; i += 4) d += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return d / ((a.length / 4) * 3 * 255) < 0.035;
  };
  const memo = new Map();
  return (a, b) => {
    if (a.key === b.key && a.k === b.k) return true;
    const id = `${a.key}${a.k}|${b.key}${b.k}`;
    if (!memo.has(id)) memo.set(id, close(sigs[a.key][a.k], sigs[b.key][b.k]));
    return memo.get(id);
  };
}

// isometric projection (camera looking from (1,1,1))
const EX = [1 / Math.SQRT2, 0, -1 / Math.SQRT2];
const EY = [-1 / Math.sqrt(6), 2 / Math.sqrt(6), -1 / Math.sqrt(6)];
const proj = (p) => [p[0] * EX[0] + p[1] * EX[1] + p[2] * EX[2], -(p[0] * EY[0] + p[1] * EY[1] + p[2] * EY[2])];
const SHADE = { top: 0, front: 0.07, right: 0.17 };

/** Draw a box view (3 faces) into ctx, centred in a w x h area. */
export function drawCubeView(ctx, view, images, w, h) {
  const scale = Math.min(w, h) / 3.6;
  const cx = w / 2, cy = h / 2;
  const P = (p) => { const [x, y] = proj(p); return [cx + x * scale, cy + y * scale]; };
  for (const s of view) {
    const n = DIRS[s.side];
    const u = turnUp(CANON[s.side], n, s.k);
    const r = cross(u, n);
    const img = images[s.key];
    const S = img.width;
    const o = P([n[0] - r[0] + u[0], n[1] - r[1] + u[1], n[2] - r[2] + u[2]]);
    const ax = P([n[0] + r[0] + u[0], n[1] + r[1] + u[1], n[2] + r[2] + u[2]]);
    const ay = P([n[0] - r[0] - u[0], n[1] - r[1] - u[1], n[2] - r[2] - u[2]]);
    ctx.save();
    ctx.setTransform((ax[0] - o[0]) / S, (ax[1] - o[1]) / S, (ay[0] - o[0]) / S, (ay[1] - o[1]) / S, o[0], o[1]);
    ctx.drawImage(img, 0, 0);
    ctx.fillStyle = `rgba(0,0,0,${SHADE[s.side]})`;
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
    // outline
    const c = (a, b) => P([n[0] + a * r[0] + b * u[0], n[1] + a * r[1] + b * u[1], n[2] + a * r[2] + b * u[2]]);
    const pts = [c(-1, 1), c(1, 1), c(1, -1), c(-1, -1)];
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p)));
    ctx.closePath();
    ctx.lineWidth = Math.max(1.5, scale * 0.035);
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0e3238";
    ctx.stroke();
  }
}

/** Draw a flat net. cells: Map(path -> {key, q}) or null = each square shows its own face, unturned. */
export function drawNet(ctx, { netIndex, transform, cells }, images, w, h) {
  const net = VALID_CUBE_NETS[netIndex];
  const layout = layoutNet(net, transform);
  const ids = resolveFaceIds(net, transform);
  const cell = Math.min(w / (layout.columns + 0.4), h / (layout.rows + 0.4));
  const ox = (w - layout.columns * cell) / 2, oy = (h - layout.rows * cell) / 2;
  for (const c of layout.cells) {
    const { key, q } = cells ? cells.get(c.path) : { key: ids.get(c.path), q: 0 };
    const img = images[key];
    const x = ox + c.x * cell, y = oy + c.y * cell;
    ctx.save();
    ctx.translate(x + cell / 2, y + cell / 2);
    ctx.rotate((q * Math.PI) / 2);
    ctx.drawImage(img, -cell / 2, -cell / 2, cell, cell);
    ctx.restore();
    ctx.lineWidth = Math.max(1.5, cell * 0.035);
    ctx.strokeStyle = "#0e3238";
    ctx.strokeRect(x, y, cell, cell);
  }
}

export { dirName as sideOf };
