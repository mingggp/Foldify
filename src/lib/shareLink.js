// Share links / QR codes for worksheets.
//
//   ?v=1&net=3&labels=ABCDEF&turn=000100&rot=0&flip=0&fold=0&quiz=1
//   ?v=1&box=<firestoreId>
//
//   v      format version (always written; links without it are read as v1)
//   net    1–11, the number shown in the net picker
//   labels one label per square in PAPER READING ORDER (left→right, top→bottom
//          of the flat net as it is shown). Single characters can be written
//          together ("ABCDEF", "กขคงจฉ"); use commas for longer labels
//          ("A1,A2,..."). "_" or empty = blank square.
//   turn   per square, quarter turns clockwise of its label (0–3), same order
//   rot    quarter turns clockwise of the whole net on the page (0–3)
//   flip   1 = mirrored net shape (the labels themselves are never mirrored)
//   fold   0–100, how folded the box starts
//   quiz   1 = open "guess before folding" straight away
//   box    a saved PUBLIC box id (for designs with pictures / shapes)
//
// The app builds these links itself (Share / QR dialog), so nobody needs to
// type them by hand. Bump LINK_VERSION and keep reading old versions if the
// format ever changes, so printed QR codes keep working.

import { VALID_CUBE_NETS } from "../components/canvas/netsConfig";
import { layoutNet, normalizeTransform, resolveFaceIds } from "./netGeometry";

export const LINK_VERSION = 1;

export const appBaseUrl = () => `${window.location.origin}${window.location.pathname}`;
export const MAX_LABEL_LENGTH = 4;
const BLANK = "_";

const clampInt = (v, min, max, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Split a string into user-perceived characters (keeps Thai vowels/tones with their consonant). */
export function splitGraphemes(text) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

/** "ABCDEF" | "A,B,,D" | "กิขคงจฉ" -> exactly 6 labels ('' = blank). */
export function parseLabels(raw) {
  if (raw == null) return null;
  const text = String(raw).normalize("NFC");
  const parts = text.includes(",") ? text.split(",") : splitGraphemes(text);
  const labels = parts.slice(0, 6).map((p) => {
    const s = p.trim();
    return s === BLANK ? "" : splitGraphemes(s).slice(0, MAX_LABEL_LENGTH).join("");
  });
  while (labels.length < 6) labels.push("");
  return labels;
}

export function formatLabels(labels) {
  const clean = labels.map((l) => (l ? String(l) : ""));
  const allSingle = clean.every((l) => l !== BLANK && l !== "," && splitGraphemes(l).length === 1);
  // Compact form when every square has exactly one character
  if (allSingle) return clean.join("");
  return clean.map((l) => (l === "" ? BLANK : l)).join(",");
}

export function parseTurns(raw) {
  const digits = String(raw ?? "").replace(/[^0-9]/g, "").slice(0, 6).split("");
  const turns = digits.map((d) => Number(d) % 4);
  while (turns.length < 6) turns.push(0);
  return turns;
}

/** Squares of a placed net in paper reading order: [{ path, x, y, faceId }] */
export function paperOrder(netIndex, transform) {
  const net = VALID_CUBE_NETS[netIndex] || VALID_CUBE_NETS[0];
  const t = normalizeTransform(transform);
  const layout = layoutNet(net, t);
  const ids = resolveFaceIds(net, t);
  const cells = [...layout.cells].sort((a, b) => a.y - b.y || a.x - b.x);
  return {
    columns: layout.columns,
    rows: layout.rows,
    cells: cells.map((c) => ({ path: c.path, x: c.x, y: c.y, faceId: ids.get(c.path) })),
  };
}

/**
 * Read share parameters from a query string. Returns null when the URL has none.
 * Never throws: bad values are clamped / ignored.
 */
export function parseShareLink(search) {
  const p = new URLSearchParams(search);
  const box = p.get("box");
  if (box && /^[A-Za-z0-9_-]{1,64}$/.test(box)) return { version: clampInt(p.get("v"), 1, 99, 1), box };
  if (!p.has("net") && !p.has("labels")) return null;
  return {
    version: clampInt(p.get("v"), 1, 99, 1),
    netIndex: clampInt(p.get("net"), 1, 11, 1) - 1,
    transform: { rotation: clampInt(p.get("rot"), 0, 3, 0), flipX: p.get("flip") === "1", flipY: false },
    labels: parseLabels(p.get("labels")),
    turns: parseTurns(p.get("turn")),
    fold: clampInt(p.get("fold"), 0, 100, 0) / 100,
    quiz: p.get("quiz") === "1",
  };
}

/**
 * Same placement written with flipX only: flipY = flipX + 180°, flipX+flipY = 180°.
 * (Order of operations is flipX -> flipY -> rotation, see netGeometry.js.)
 */
export function canonicalTransform(transform) {
  const t = normalizeTransform(transform);
  if (!t.flipY) return t;
  return { rotation: (t.rotation + 2) % 4, flipX: !t.flipX, flipY: false };
}

/** Build a share URL. `base` is e.g. window.location.origin + window.location.pathname. */
export function buildShareLink(base, { netIndex = 0, transform = {}, labels, turns, fold = 0, quiz = false, box } = {}) {
  const parts = [`v=${LINK_VERSION}`];
  if (box) {
    parts.push(`box=${encodeURIComponent(box)}`);
  } else {
    const t = canonicalTransform(transform);
    parts.push(`net=${netIndex + 1}`);
    if (labels && labels.some((l) => l)) parts.push(`labels=${encodeURIComponent(formatLabels(labels)).replace(/%2C/g, ",")}`);
    if (turns && turns.some((x) => x)) parts.push(`turn=${turns.map((x) => ((x % 4) + 4) % 4).join("")}`);
    if (t.rotation) parts.push(`rot=${t.rotation}`);
    if (t.flipX) parts.push("flip=1");
    if (fold > 0) parts.push(`fold=${Math.round(fold * 100)}`);
    if (quiz) parts.push("quiz=1");
  }
  return `${base}?${parts.join("&")}`;
}

/** Map paper-order labels onto face ids: { faceId: { label, turn } } */
export function labelsToFaces(netIndex, transform, labels, turns = []) {
  const { cells } = paperOrder(netIndex, transform);
  const out = {};
  cells.forEach((cell, i) => {
    out[cell.faceId] = { label: labels?.[i] || "", turn: turns?.[i] || 0 };
  });
  return out;
}

/** Inverse of labelsToFaces: read labels back in paper order for the current net. */
export function facesToLabels(netIndex, transform, faceLabels = {}) {
  const { cells } = paperOrder(netIndex, transform);
  return {
    labels: cells.map((c) => faceLabels[c.faceId]?.label || ""),
    turns: cells.map((c) => faceLabels[c.faceId]?.turn || 0),
  };
}
