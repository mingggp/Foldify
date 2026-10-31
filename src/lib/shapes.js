// Shapes drawn on a face. One renderer (canvas Path2D) is used both by the 3D box
// (components/canvas/Box.jsx) and by the shape editor, so what you see while editing
// is exactly what ends up on the box.
//
// A face is a 1024 x 1024 canvas, x to the right, y down (same as the picture).
// Shape (as saved):
//   { id, type, x, y, w, h, rotation, flipX, fill, stroke, strokeWidth, pts }
//   x, y      centre on the face, in face pixels
//   w, h      size of the shape's box in face pixels (lines: w = length)
//   rotation  degrees, clockwise
//   fill      main colour (for lines: the line colour)
//   stroke    outline colour or null; strokeWidth in face pixels
//   pts       only for type "path": flat list [x0, y0, x1, y1, ...] in the box's
//             0..100 space (flat because Firestore can't store arrays inside arrays)
//   closed    only for type "path": filled shape (true) or an open line (false)

export const FACE_SIZE = 1024;

const star = (n, outer, inner, startDeg = -90) => {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = ((startDeg + (i * 180) / n) * Math.PI) / 180;
    pts.push(`${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`);
  }
  return `M${pts.join("L")}Z`;
};

// Templates are drawn in a 0..100 box and stretched to the shape's w x h.
// `size` is the default [w, h] in face pixels.
const T = (id, d, size = [360, 360], extra = {}) => ({ id, d, size, ...extra });

export const SHAPE_GROUPS = [
  {
    id: "shapes",
    items: [
      T("square", "M0 0H100V100H0Z"),
      T("rounded", "M18 0H82A18 18 0 0 1 100 18V82A18 18 0 0 1 82 100H18A18 18 0 0 1 0 82V18A18 18 0 0 1 18 0Z"),
      T("circle", "M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z"),
      T("triangle", "M50 0L100 100H0Z", [400, 346]),
      T("triangle-down", "M0 0H100L50 100Z", [400, 346]),
      T("diamond", "M50 0L100 50L50 100L0 50Z"),
      T("plus", "M33 0H67V33H100V67H67V100H33V67H0V33H33Z"),
      T("barrel", "M0 7L50 0L100 7V93L50 100L0 93Z"),
      T("ticket", "M10 0H90A10 10 0 0 0 100 10V90A10 10 0 0 0 90 100H10A10 10 0 0 0 0 90V10A10 10 0 0 0 10 0Z"),
      T("parallelogram", "M25 0H100L75 100H0Z", [440, 300]),
      T("parallelogram-left", "M0 0H75L100 100H25Z", [440, 300]),
      T("trapezoid", "M25 0H75L100 100H0Z", [440, 300]),
      T("trapezoid-down", "M0 0H100L75 100H25Z", [440, 300]),
      T("tomb-down", "M0 0H100V50A50 50 0 0 1 0 50Z", [320, 400]),
      T("arch", "M0 100V50A50 50 0 0 1 100 50V100Z", [320, 400]),
      T("right-triangle", "M0 0L100 100H0Z"),
      T("semicircle", "M0 100A50 100 0 0 1 100 100Z", [400, 200]),
      T("quarter", "M100 0V100H0A100 100 0 0 1 100 0Z"),
      T("quarter-ring", "M100 0V40A60 60 0 0 0 40 100H0A100 100 0 0 1 100 0Z"),
      T("half-ring", "M0 100A50 100 0 0 1 100 100H74A24 48 0 0 0 26 100Z", [400, 200]),
      T("star", star(5, 50, 20)),
      T("heart", "M50 96L12 58C-6 40 2 8 28 8C40 8 47 15 50 22C53 15 60 8 72 8C98 8 106 40 88 58Z"),
      T("hexagon", "M25 3H75L100 50L75 97H25L0 50Z", [400, 346]),
      T("pentagon", "M50 0L100 38L81 100H19L0 38Z"),
      T("arrow-right", "M0 30H55V0L100 50L55 100V70H0Z", [420, 300]),
      T("arrow-left", "M100 30H45V0L0 50L45 100V70H100Z", [420, 300]),
      T("arrow-up", "M30 100V45H0L50 0L100 45H70V100Z", [300, 420]),
      T("arrow-down", "M30 0V55H0L50 100L100 55H70V0Z", [300, 420]),
      T("arrow-both", "M0 50L30 15V35H70V15L100 50L70 85V65H30V85Z", [440, 260]),
      T("arrow-updown", "M50 0L85 30H65V70H85L50 100L15 70H35V30H15Z", [260, 440]),
      T("tag", "M0 0H75L100 50L75 100H0Z", [420, 220]),
      T("chevron", "M0 0H75L100 50L75 100H0L25 50Z", [420, 220]),
      T("arrow-thin", "M0 50L45 8L35 38H100V62H35L45 92Z", [420, 300]),
      T("quatrefoil", "M25 25A25 25 0 0 1 75 25A25 25 0 0 1 75 75A25 25 0 0 1 25 75A25 25 0 0 1 25 25Z"),
      T("quatrefoil-hole", "M25 25A25 25 0 0 1 75 25A25 25 0 0 1 75 75A25 25 0 0 1 25 75A25 25 0 0 1 25 25ZM38 38V62H62V38Z", [360, 360], { evenodd: true }),
      T("sparkle", "M50 0Q56 44 100 50Q56 56 50 100Q44 56 0 50Q44 44 50 0Z"),
      T("crescent", "M62 0A50 50 0 1 0 62 100A40 50 0 1 1 62 0Z", [300, 360]),
      T("cut-corner", "M40 0H100V55L58 100H0V45Z"),
      T("pill", "M25 0H75A25 25 0 0 1 75 50H25A25 25 0 0 1 25 0ZM25 50H75A25 25 0 0 1 75 100H25A25 25 0 0 1 25 50Z", [400, 320]),
      T("burst", star(8, 50, 34, -90)),
      T("drop", "M50 0C50 0 90 45 90 66A40 34 0 0 1 10 66C10 45 50 0 50 0Z", [300, 380]),
    ],
  },
  {
    id: "lines",
    items: [
      { id: "line", line: "plain", size: [480, 0] },
      { id: "line-dashed", line: "dashed", size: [480, 0] },
      { id: "line-arrow", line: "arrow", size: [480, 0] },
      { id: "line-double", line: "double", size: [480, 0] },
      { id: "line-ends", line: "ends", size: [480, 0] },
    ],
  },
];

export const SHAPES = Object.fromEntries(SHAPE_GROUPS.flatMap((g) => g.items.map((t) => [t.id, t])));

export const isLine = (s) => !!SHAPES[s.type]?.line;
export const isOpenPath = (s) => s.type === "path" && !s.closed;
/** shapes whose length matters, not their height: dragged by their two ends */
export const isLineLike = (s) => isLine(s);

let nextId = 0;
export const newShapeId = () => `${Date.now().toString(36)}${(nextId++).toString(36)}`;

/** Read a saved shape, including the old {type, scale, color} stickers. */
export function normalizeShape(s) {
  if (!s) return null;
  if (s.w != null) return s;
  const size = 100 * (s.scale || 1);
  return {
    id: s.id ?? newShapeId(),
    type: s.type === "square" || s.type === "circle" ? s.type : "legacy-star",
    x: s.x ?? 512,
    y: s.y ?? 512,
    w: size,
    h: size,
    rotation: s.rotation || 0,
    flipX: false,
    fill: s.color || "#28a1ab",
    stroke: null,
    strokeWidth: 0,
  };
}

// the old star sticker (outer radius 50, inner 20, first point at 18°)
SHAPES["legacy-star"] = T("legacy-star", star(5, 50, 20, -90));

export function makeShape(type, { x = 512, y = 512, fill = "#28a1ab" } = {}) {
  const t = SHAPES[type];
  const [w, h] = t.size;
  return {
    id: newShapeId(),
    type,
    x,
    y,
    w,
    h,
    rotation: 0,
    flipX: false,
    fill,
    stroke: null,
    strokeWidth: t.line ? 14 : 0,
  };
}

/** A pen-drawn shape from absolute face points [[x, y], ...]. */
export function makePathShape(points, closed, fill) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
  return {
    id: newShapeId(),
    type: "path",
    closed,
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    w,
    h,
    rotation: 0,
    flipX: false,
    fill,
    stroke: null,
    strokeWidth: closed ? 0 : 14,
    pts: points.flatMap(([px, py]) => [round2(((px - minX) / w) * 100), round2(((py - minY) / h) * 100)]),
  };
}

const round2 = (v) => Math.round(v * 100) / 100;

// ---------- geometry ----------

const rad = (deg) => (deg * Math.PI) / 180;

/** face point -> shape-local point (origin at the centre, before rotation / flip) */
export function toLocal(s, px, py) {
  const dx = px - s.x, dy = py - s.y;
  const c = Math.cos(-rad(s.rotation)), si = Math.sin(-rad(s.rotation));
  let lx = dx * c - dy * si;
  const ly = dx * si + dy * c;
  if (s.flipX) lx = -lx;
  return [lx, ly];
}

/** shape-local point -> face point */
export function toFace(s, lx, ly) {
  if (s.flipX) lx = -lx;
  const c = Math.cos(rad(s.rotation)), si = Math.sin(rad(s.rotation));
  return [s.x + lx * c - ly * si, s.y + lx * si + ly * c];
}

/** corners of a pen shape in face pixels */
export function pathPoints(s) {
  const out = [];
  for (let i = 0; i < (s.pts?.length || 0); i += 2) {
    out.push(toFace(s, (s.pts[i] / 100 - 0.5) * s.w, (s.pts[i + 1] / 100 - 0.5) * s.h));
  }
  return out;
}

/** the two ends of a line, in face pixels */
export function lineEnds(s) {
  return [toFace(s, -s.w / 2, 0), toFace(s, s.w / 2, 0)];
}

/** Rebuild a line from two end points. */
export function lineFromEnds(s, [a, b]) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  return { ...s, flipX: false, x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2, w: Math.max(1, Math.hypot(dx, dy)), rotation: (Math.atan2(dy, dx) * 180) / Math.PI };
}

/** Rebuild a pen shape after moving its corners (keeps its rotation). */
export function pathFromPoints(s, facePoints) {
  const local = facePoints.map(([px, py]) => toLocal(s, px, py));
  const xs = local.map((p) => p[0]), ys = local.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(1, maxX - minX), h = Math.max(1, maxY - minY);
  const [cx, cy] = toFace(s, (minX + maxX) / 2, (minY + maxY) / 2);
  return {
    ...s,
    x: cx,
    y: cy,
    w,
    h,
    pts: local.flatMap(([lx, ly]) => [round2(((lx - minX) / w) * 100), round2(((ly - minY) / h) * 100)]),
  };
}

// ---------- drawing ----------

function templatePath(d, w, h) {
  const p = new Path2D();
  p.addPath(new Path2D(d), new DOMMatrix([w / 100, 0, 0, h / 100, -w / 2, -h / 2]));
  return p;
}

function penPath(s) {
  const p = new Path2D();
  for (let i = 0; i < (s.pts?.length || 0); i += 2) {
    const x = (s.pts[i] / 100 - 0.5) * s.w, y = (s.pts[i + 1] / 100 - 0.5) * s.h;
    if (i === 0) p.moveTo(x, y);
    else p.lineTo(x, y);
  }
  if (s.closed) p.closePath();
  return p;
}

const arrowHead = (p, tipX, dir, size) => {
  p.moveTo(tipX, 0);
  p.lineTo(tipX - dir * size * 1.4, -size);
  p.lineTo(tipX - dir * size * 1.4, size);
  p.closePath();
};

/**
 * Parts to draw for one shape, in shape-local coordinates:
 * [{ path, fill?, stroke?, width?, dash?, rule? }]
 */
export function shapeParts(shape) {
  const s = normalizeShape(shape);
  const t = SHAPES[s.type];
  const outline = s.stroke && s.strokeWidth > 0 ? { stroke: s.stroke, width: s.strokeWidth } : null;

  if (s.type === "path") {
    const path = penPath(s);
    if (!s.closed) return [{ path, stroke: s.fill, width: Math.max(2, s.strokeWidth || 14), join: true }];
    return [{ path, fill: s.fill, rule: "nonzero" }, outline && { path, ...outline, join: true }].filter(Boolean);
  }

  if (t?.line) {
    const sw = Math.max(2, s.strokeWidth || 14);
    const half = s.w / 2;
    const head = sw * 2.2;
    const parts = [];
    const shaft = new Path2D();
    const startX = t.line === "double" ? -half + head * 1.2 : -half;
    const endX = t.line === "arrow" || t.line === "double" ? half - head * 1.2 : half;
    shaft.moveTo(startX, 0);
    shaft.lineTo(endX, 0);
    parts.push({ path: shaft, stroke: s.fill, width: sw, dash: t.line === "dashed" ? [sw * 2.2, sw * 1.6] : null, cap: t.line === "dashed" ? "butt" : "round" });
    if (t.line === "arrow" || t.line === "double") {
      const heads = new Path2D();
      arrowHead(heads, half, 1, head);
      if (t.line === "double") arrowHead(heads, -half, -1, head);
      parts.push({ path: heads, fill: s.fill });
    }
    if (t.line === "ends") {
      const ends = new Path2D();
      const k = sw * 1.6;
      ends.rect(-half - k, -k, k * 2, k * 2);
      ends.rect(half - k, -k, k * 2, k * 2);
      parts.push({ path: ends, fill: s.fill });
    }
    return parts;
  }

  if (!t) return [];
  const path = templatePath(t.d, s.w, s.h);
  return [{ path, fill: s.fill, rule: t.evenodd ? "evenodd" : "nonzero" }, outline && { path, ...outline, join: true }].filter(Boolean);
}

function applyShapeTransform(ctx, s) {
  ctx.translate(s.x, s.y);
  ctx.rotate(rad(s.rotation || 0));
  if (s.flipX) ctx.scale(-1, 1);
}

/** Draw shapes (bottom first) onto a 1024 face canvas context. */
export function drawShapes(ctx, shapes) {
  for (const raw of shapes || []) {
    const s = normalizeShape(raw);
    if (!s) continue;
    ctx.save();
    applyShapeTransform(ctx, s);
    for (const part of shapeParts(s)) {
      if (part.fill) {
        ctx.fillStyle = part.fill;
        ctx.fill(part.path, part.rule || "nonzero");
      }
      if (part.stroke) {
        ctx.strokeStyle = part.stroke;
        ctx.lineWidth = part.width;
        ctx.lineCap = part.cap || "round";
        ctx.lineJoin = part.join ? "round" : "miter";
        ctx.setLineDash(part.dash || []);
        ctx.stroke(part.path);
        ctx.setLineDash([]);
      }
    }
    ctx.restore();
  }
}

let hitCtx = null;
/** Is face point (px, py) on this shape? `slack` widens thin lines for fingers. */
export function hitShape(shape, px, py, slack = 28) {
  if (typeof document === "undefined") return false;
  hitCtx = hitCtx || document.createElement("canvas").getContext("2d");
  const s = normalizeShape(shape);
  const [lx, ly] = toLocal(s, px, py);
  for (const part of shapeParts(s)) {
    if (part.fill && hitCtx.isPointInPath(part.path, lx, ly, part.rule || "nonzero")) return true;
    if (part.stroke) {
      hitCtx.lineWidth = Math.max(part.width, slack);
      hitCtx.lineCap = "round";
      hitCtx.lineJoin = "round";
      if (hitCtx.isPointInStroke(part.path, lx, ly)) return true;
    }
  }
  return false;
}

/** A small SVG preview of a template (for the library buttons). */
export function templatePreview(id) {
  const t = SHAPES[id];
  if (!t) return null;
  if (t.line) return { line: t.line };
  return { d: t.d, evenodd: !!t.evenodd, aspect: t.size[0] / t.size[1] };
}

/** [English, Thai] names for the library buttons */
export const SHAPE_NAMES = {
  square: ["Square", "สี่เหลี่ยมจัตุรัส"],
  rounded: ["Rounded square", "สี่เหลี่ยมมุมมน"],
  circle: ["Circle", "วงกลม"],
  triangle: ["Triangle", "สามเหลี่ยม"],
  "triangle-down": ["Upside-down triangle", "สามเหลี่ยมกลับหัว"],
  diamond: ["Diamond", "สี่เหลี่ยมขนมเปียกปูน"],
  plus: ["Plus", "กากบาท"],
  barrel: ["Barrel", "ทรงถัง"],
  ticket: ["Ticket", "ตั๋ว"],
  parallelogram: ["Parallelogram", "สี่เหลี่ยมด้านขนาน"],
  "parallelogram-left": ["Parallelogram (left)", "สี่เหลี่ยมด้านขนาน (เอียงซ้าย)"],
  trapezoid: ["Trapezoid", "สี่เหลี่ยมคางหมู"],
  "trapezoid-down": ["Upside-down trapezoid", "สี่เหลี่ยมคางหมูกลับหัว"],
  "tomb-down": ["Round bottom", "ทรงก้นมน"],
  arch: ["Arch", "ทรงโค้งประตู"],
  "right-triangle": ["Right triangle", "สามเหลี่ยมมุมฉาก"],
  semicircle: ["Half circle", "ครึ่งวงกลม"],
  quarter: ["Quarter circle", "เสี้ยววงกลม"],
  "quarter-ring": ["Quarter ring", "เสี้ยววงแหวน"],
  "half-ring": ["Half ring", "ครึ่งวงแหวน"],
  star: ["Star", "ดาว"],
  heart: ["Heart", "หัวใจ"],
  hexagon: ["Hexagon", "หกเหลี่ยม"],
  pentagon: ["Pentagon", "ห้าเหลี่ยม"],
  line: ["Line", "เส้นตรง"],
  "line-dashed": ["Dashed line", "เส้นประ"],
  "line-arrow": ["Arrow line", "เส้นลูกศร"],
  "line-double": ["Two-way arrow line", "เส้นลูกศรสองทาง"],
  "line-ends": ["Line with ends", "เส้นมีหัวท้าย"],
  "arrow-right": ["Arrow right", "ลูกศรขวา"],
  "arrow-left": ["Arrow left", "ลูกศรซ้าย"],
  "arrow-up": ["Arrow up", "ลูกศรขึ้น"],
  "arrow-down": ["Arrow down", "ลูกศรลง"],
  "arrow-both": ["Left-right arrow", "ลูกศรซ้าย–ขวา"],
  "arrow-updown": ["Up-down arrow", "ลูกศรขึ้น–ลง"],
  tag: ["Tag", "ป้าย"],
  chevron: ["Chevron", "บั้ง"],
  "arrow-thin": ["Thin arrow", "ลูกศรเรียว"],
  quatrefoil: ["Four petals", "สี่กลีบ"],
  "quatrefoil-hole": ["Four petals with hole", "สี่กลีบเจาะรู"],
  sparkle: ["Sparkle", "ประกาย"],
  crescent: ["Crescent", "พระจันทร์เสี้ยว"],
  "cut-corner": ["Cut corners", "ตัดมุม"],
  pill: ["Two pills", "แคปซูลซ้อน"],
  burst: ["Burst", "ดาวแฉก"],
  drop: ["Drop", "หยดน้ำ"],
  path: ["Drawn shape", "รูปทรงที่วาดเอง"],
  "legacy-star": ["Star", "ดาว"],
};
