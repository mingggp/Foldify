import { useEffect, useMemo, useRef, useState } from "react";
import { Shapes, MousePointer2, PenTool, Grid3x3, Undo2, Redo2, BringToFront, SendToBack, CopyPlus, FlipHorizontal, Trash2, Check, X, Eraser } from "lucide-react";
import Modal, { Segmented } from "../ui/Modal";
import { useLang } from "../../contexts/LanguageContext";
import {
  FACE_SIZE, SHAPE_GROUPS, SHAPE_NAMES, drawShapes, hitShape, isLine, lineEnds, lineFromEnds, makePathShape, makeShape,
  newShapeId, normalizeShape, pathFromPoints, pathPoints, templatePreview, toFace, toLocal,
} from "../../lib/shapes";

const FACE_ORDER = ["top", "front", "left", "right", "back", "bottom"];
const COLORS = ["#28a1ab", "#00c8b5", "#00d5c9", "#0e3238", "#ffffff", "#ffb238", "#ff7a59", "#e5484d", "#f7a8c4", "#8b7cf6", "#4f8ef7", "#9be15d", "#94a3b8"];
const GRID = 64; // snap step in face pixels (1/16 of a face)
const SNAP_DIST = 30; // how close (face px) a point must be to snap onto another corner
const MIN = 16;
const MAX_SHAPES = 50; // the saved-box rules allow 50 shapes per face
const CORNER_OFF = 44; // pen shapes: keep the resize handle clear of the corner points

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const normalizeAll = (shapes) => (shapes || []).map(normalizeShape).filter(Boolean);

/** Library button preview */
function Preview({ id }) {
  const p = templatePreview(id);
  if (!p) return null;
  if (p.line) {
    return (
      <svg viewBox="0 0 100 40" className="w-full h-6" aria-hidden="true">
        <line x1="8" y1="20" x2={p.line === "arrow" || p.line === "double" ? 80 : 92} y2="20" stroke="currentColor" strokeWidth="6" strokeLinecap={p.line === "dashed" ? "butt" : "round"} strokeDasharray={p.line === "dashed" ? "12 9" : undefined} />
        {(p.line === "arrow" || p.line === "double") && <path d="M96 20L78 9V31Z" fill="currentColor" />}
        {p.line === "double" && <path d="M4 20L22 9V31Z" fill="currentColor" />}
        {p.line === "ends" && <path d="M2 12h14v16H2zM84 12h14v16H84z" fill="currentColor" />}
      </svg>
    );
  }
  const w = p.aspect >= 1 ? 100 : 100 * p.aspect;
  const h = p.aspect >= 1 ? 100 / p.aspect : 100;
  return (
    <svg viewBox="-4 -4 108 108" className="w-full h-full" aria-hidden="true">
      <g transform={`translate(${(100 - w) / 2} ${(100 - h) / 2}) scale(${w / 100} ${h / 100})`}>
        <path d={p.d} fill="currentColor" fillRule={p.evenodd ? "evenodd" : "nonzero"} />
      </g>
    </svg>
  );
}

/**
 * Minimal shape editor for one face: add shapes from a library, draw your own shape
 * by joining points (snapping to a grid and to other shapes' corners), move / resize /
 * rotate, recolour, reorder. Every finished change is one undo step.
 */
export default function ShapeEditor({ faceId, facesConfig, setFacesConfig, onPickFace, onClose, undo, redo, canUndo, canRedo }) {
  const { t, lang } = useLang();
  const face = facesConfig[faceId];
  const name = (id) => (SHAPE_NAMES[id] || [id, id])[lang === "th" ? 1 : 0];

  // ---- draft shapes (live while dragging) + sync with the app (undo, other face) ----
  const [synced, setSynced] = useState({ faceId, shapes: face.shapes });
  const [draft, setDraft] = useState(() => normalizeAll(face.shapes));
  const [selectedId, setSelectedId] = useState(null);
  const [tool, setTool] = useState("select");
  const [pen, setPen] = useState([]);
  const [hover, setHover] = useState(null);
  const [snapOn, setSnapOn] = useState(true);
  const [color, setColor] = useState("#28a1ab");
  const [group, setGroup] = useState("basic");
  if (synced.faceId !== faceId || synced.shapes !== face.shapes) {
    setSynced({ faceId, shapes: face.shapes });
    setDraft(normalizeAll(face.shapes));
    if (synced.faceId !== faceId) {
      setSelectedId(null);
      setPen([]);
    }
  }
  const selected = draft.find((s) => s.id === selectedId) || null;

  const commit = (next) => {
    setDraft(next);
    setSynced({ faceId, shapes: next });
    setFacesConfig((prev) => ({ ...prev, [faceId]: { ...prev[faceId], shapes: next, activeShapeIndex: null } }));
  };
  const updateSelected = (patch, doCommit = true) => {
    const next = draft.map((s) => (s.id === selectedId ? { ...s, ...(typeof patch === "function" ? patch(s) : patch) } : s));
    if (doCommit) commit(next);
    else setDraft(next);
  };

  // ---- face background (colour + picture), drawn with the same renderer as the box ----
  const canvasRef = useRef(null);
  const [img, setImg] = useState({ url: null, el: null });
  useEffect(() => {
    if (!face.textureUrl) return;
    let cancelled = false;
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => { if (!cancelled) setImg({ url: face.textureUrl, el }); };
    el.src = face.textureUrl;
    return () => { cancelled = true; };
  }, [face.textureUrl]);
  const picture = face.textureUrl && img.url === face.textureUrl ? img.el : null;

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, FACE_SIZE, FACE_SIZE);
    ctx.fillStyle = face.color || "#ffffff";
    ctx.fillRect(0, 0, FACE_SIZE, FACE_SIZE);
    if (picture) ctx.drawImage(picture, 0, 0, FACE_SIZE, FACE_SIZE);
    drawShapes(ctx, draft);
  }, [draft, face.color, picture]);

  // ---- snapping ----
  const corners = useMemo(() => {
    const out = [];
    for (const s of draft) {
      if (s.type === "path") pathPoints(s).forEach((p) => out.push({ p, id: s.id }));
      else if (isLine(s)) lineEnds(s).forEach((p) => out.push({ p, id: s.id }));
    }
    return out;
  }, [draft]);

  const snap = (p, { excludeId = null, extra = [] } = {}) => {
    let best = null;
    for (const c of [...corners.filter((c) => c.id !== excludeId).map((c) => c.p), ...extra]) {
      const d = dist(c, p);
      if (d < SNAP_DIST && (!best || d < best.d)) best = { d, p: c };
    }
    if (best) return { p: [...best.p], kind: "corner" };
    if (snapOn) return { p: [Math.round(p[0] / GRID) * GRID, Math.round(p[1] / GRID) * GRID], kind: "grid" };
    return { p, kind: null };
  };

  // ---- pointer handling on the overlay ----
  const svgRef = useRef(null);
  const drag = useRef(null);
  const [dragMode, setDragMode] = useState(null);
  const toFacePoint = (e) => {
    const r = svgRef.current.getBoundingClientRect();
    const clamp = (v) => Math.min(FACE_SIZE, Math.max(0, v));
    return [clamp(((e.clientX - r.left) / r.width) * FACE_SIZE), clamp(((e.clientY - r.top) / r.height) * FACE_SIZE)];
  };

  const removeSelected = () => { commit(draft.filter((s) => s.id !== selectedId)); setSelectedId(null); };

  const finishPen = (closed) => {
    const pts = pen;
    setPen([]);
    setHover(null);
    if (pts.length < 2 || (closed && pts.length < 3) || draft.length >= MAX_SHAPES) return;
    const shape = makePathShape(pts, closed, color);
    commit([...draft, shape]);
    setSelectedId(shape.id);
    setTool("select");
  };

  const onPointerDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    const p = toFacePoint(e);
    if (tool === "pen") {
      if (pen.length >= 3 && dist(p, pen[0]) < SNAP_DIST * 1.4) return finishPen(true);
      const { p: q } = snap(p, { extra: pen });
      if (pen.length && dist(q, pen[pen.length - 1]) < 2) return;
      setPen([...pen, q]);
      return;
    }
    const handle = e.target.closest?.("[data-handle]")?.getAttribute("data-handle");
    if (handle && selected) {
      drag.current = { mode: handle, orig: selected, start: p, moved: false };
      setDragMode(handle);
    } else {
      const hit = [...draft].reverse().find((s) => hitShape(s, p[0], p[1]));
      setSelectedId(hit ? hit.id : null);
      if (!hit) return;
      drag.current = { mode: "move", orig: hit, start: p, moved: false };
      setDragMode("move");
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const p = toFacePoint(e);
    if (tool === "pen") {
      setHover(pen.length ? snap(p, { extra: pen }) : snap(p));
      return;
    }
    const d = drag.current;
    if (!d) return;
    d.moved = true;
    const o = d.orig;
    let next = o;
    if (d.mode === "move") {
      next = { ...o, x: o.x + p[0] - d.start[0], y: o.y + p[1] - d.start[1] };
    } else if (d.mode === "rotate") {
      let deg = (Math.atan2(p[1] - o.y, p[0] - o.x) * 180) / Math.PI + 90;
      const near = Math.round(deg / 15) * 15;
      if (Math.abs(deg - near) < 5) deg = near;
      next = { ...o, rotation: ((deg % 360) + 360) % 360 };
    } else if (d.mode === "corner" || d.mode === "side-x" || d.mode === "side-y") {
      const [lx, ly] = toLocal(o, p[0], p[1]);
      if (d.mode === "corner") {
        const off = o.type === "path" ? CORNER_OFF : 0;
        const k = Math.max((Math.abs(lx) - off) / (o.w / 2), (Math.abs(ly) - off) / (o.h / 2));
        next = { ...o, w: Math.max(MIN, o.w * k), h: Math.max(MIN, o.h * k) };
      } else if (d.mode === "side-x") next = { ...o, w: Math.max(MIN, Math.abs(lx) * 2) };
      else next = { ...o, h: Math.max(MIN, Math.abs(ly) * 2) };
    } else if (d.mode.startsWith("end:")) {
      const i = +d.mode.slice(4);
      const ends = lineEnds(o);
      ends[i] = snap(p, { excludeId: o.id }).p;
      if (dist(ends[0], ends[1]) >= MIN) next = lineFromEnds(o, ends);
    } else if (d.mode.startsWith("pt:")) {
      const i = +d.mode.slice(3);
      const pts = pathPoints(o);
      pts[i] = snap(p, { excludeId: o.id, extra: pts.filter((_, j) => j !== i) }).p;
      next = pathFromPoints(o, pts);
    }
    setDraft(draft.map((s) => (s.id === o.id ? next : s)));
  };

  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    setDragMode(null);
    if (d?.moved) commit(draft);
  };

  // ---- keyboard: delete, nudge, Esc (before the dialog's own Esc) ----
  const keyRef = useRef(null);
  const onKey = (e) => {
    if (e.target.closest?.("input, textarea")) return;
    if (e.key === "Escape") {
      if (pen.length || tool === "pen") { e.stopImmediatePropagation(); setPen([]); setTool("select"); return; }
      if (selected) { e.stopImmediatePropagation(); setSelectedId(null); return; }
      return;
    }
    if (e.key === "Enter" && tool === "pen") { e.preventDefault(); finishPen(false); return; }
    if (!selected) return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); return; }
    const step = e.shiftKey ? GRID : 8;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (move) { e.preventDefault(); updateSelected((s) => ({ x: s.x + move[0], y: s.y + move[1] })); }
  };
  useEffect(() => { keyRef.current = onKey; });
  useEffect(() => {
    const h = (e) => keyRef.current?.(e);
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, []);

  // ---- actions ----
  const addTemplate = (type) => {
    if (draft.length >= MAX_SHAPES) return;
    const n = draft.length % 6;
    const shape = makeShape(type, { x: 512 + n * 24, y: 512 + n * 24, fill: color });
    commit([...draft, shape]);
    setSelectedId(shape.id);
    setTool("select");
  };
  const duplicate = () => {
    const copy = { ...selected, id: newShapeId(), x: selected.x + 40, y: selected.y + 40 };
    commit([...draft, copy]);
    setSelectedId(copy.id);
  };
  const restack = (dir) => {
    const i = draft.findIndex((s) => s.id === selectedId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= draft.length) return;
    const next = [...draft];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  const pickColor = (c) => { setColor(c); if (selected) updateSelected({ fill: c }); };

  // ---- overlay drawing ----
  const box = selected && !isLine(selected) ? [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => toFace(selected, (a * selected.w) / 2, (b * selected.h) / 2)) : null;
  const H = 18; // handle radius (face px)
  const cornerHandle = box ? toFace(selected, selected.w / 2 + (selected.type === "path" ? CORNER_OFF : 0), selected.h / 2 + (selected.type === "path" ? CORNER_OFF : 0)) : null;
  const lineStroke = selected && (isLine(selected) || (selected.type === "path" && !selected.closed));
  const outlineOn = selected && !lineStroke && selected.stroke;

  return (
    <Modal title={`${t("editorTitle")} · ${t(`face_${faceId}`)}`} icon={Shapes} onClose={onClose} size="xl" testId="shape-editor">
      <div className="grid gap-4 md:grid-cols-[13.5rem_minmax(0,1fr)]">
        {/* library */}
        <div className="space-y-3 order-2 md:order-1 min-w-0">
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-surface-2 border border-line" role="tablist">
            {SHAPE_GROUPS.map((g) => (
              <button key={g.id} role="tab" aria-selected={group === g.id} onClick={() => setGroup(g.id)} className={`h-8 rounded-lg text-xs font-semibold ${group === g.id ? "bg-surface shadow-sm" : "text-muted hover:text-ink"}`}>
                {t(`grp_${g.id}`)}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 md:grid-cols-3 gap-1.5 max-h-[38dvh] md:max-h-[52dvh] overflow-y-auto scroll-area pr-0.5">
            {SHAPE_GROUPS.find((g) => g.id === group).items.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => addTemplate(tpl.id)}
                title={name(tpl.id)}
                aria-label={name(tpl.id)}
                data-testid={`tpl-${tpl.id}`}
                className="aspect-square rounded-xl border border-line bg-surface-2 hover:border-mint hover:bg-mint/10 text-ink p-2.5 grid place-items-center transition-colors"
              >
                <Preview id={tpl.id} />
              </button>
            ))}
          </div>
          <button onClick={() => { setTool("pen"); setSelectedId(null); }} className={`btn w-full h-11 ${tool === "pen" ? "btn-on border" : "btn-soft"}`} data-testid="tool-pen">
            <PenTool size={17} />
            {t("toolPen")}
          </button>
        </div>

        {/* canvas + tools */}
        <div className="space-y-3 order-1 md:order-2 min-w-0">
          <div className="flex flex-wrap items-center gap-1">
            <Segmented
              value={tool}
              onChange={(v) => { setTool(v); setPen([]); setHover(null); }}
              label={t("tool")}
              options={[
                { value: "select", icon: <MousePointer2 size={14} />, label: t("toolSelect") },
                { value: "pen", icon: <PenTool size={14} />, label: t("toolPen") },
              ]}
            />
            <button onClick={() => setSnapOn(!snapOn)} aria-pressed={snapOn} className={`btn btn-icon ${snapOn ? "btn-on border" : "btn-ghost"}`} title={t("snapGrid")} aria-label={t("snapGrid")}>
              <Grid3x3 size={17} />
            </button>
            <span className="w-px h-6 bg-line mx-1" aria-hidden="true" />
            <div className="flex gap-0.5 overflow-x-auto scrollbar-hide min-w-0" role="radiogroup" aria-label={t("pickFace")}>
            {FACE_ORDER.map((id) => (
              <button key={id} role="radio" aria-checked={id === faceId} onClick={() => onPickFace(id)} className={`btn h-8 min-h-8 px-3 text-xs ${id === faceId ? "btn-on border" : "btn-ghost"}`}>
                {t(`face_${id}`)}
              </button>
            ))}
            </div>
            <span className="flex-1" />
            <button className="btn btn-ghost btn-icon" onClick={undo} disabled={!canUndo} title={t("undo")} aria-label={t("undo")}><Undo2 size={17} /></button>
            <button className="btn btn-ghost btn-icon" onClick={redo} disabled={!canRedo} title={t("redo")} aria-label={t("redo")}><Redo2 size={17} /></button>
            <button className="btn btn-ghost btn-icon" onClick={() => { commit([]); setSelectedId(null); }} disabled={!draft.length} title={t("clearShapes")} aria-label={t("clearShapes")}><Eraser size={17} /></button>
          </div>


          {/* pointer handlers sit on the frame, so taps right on the edge still count */}
          <div
            className="relative mx-auto w-full max-w-[min(100%,50dvh)] aspect-square rounded-xl overflow-hidden border border-line shadow-inner select-none touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={() => setHover(null)}
          >
            <canvas ref={canvasRef} width={FACE_SIZE} height={FACE_SIZE} className="absolute inset-0 w-full h-full" data-testid="editor-canvas" />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${FACE_SIZE} ${FACE_SIZE}`}
              className={`absolute inset-0 w-full h-full ${tool === "pen" ? "cursor-crosshair" : "cursor-default"}`}
              data-testid="editor-overlay"
            >
              {snapOn && (
                <g stroke="#0e3238" strokeOpacity="0.12" strokeWidth="2">
                  {Array.from({ length: 15 }, (_, i) => (i + 1) * GRID).map((v) => (
                    <g key={v} strokeOpacity={v % (GRID * 4) === 0 ? 0.28 : 0.12}>
                      <line x1={v} y1="0" x2={v} y2={FACE_SIZE} />
                      <line x1="0" y1={v} x2={FACE_SIZE} y2={v} />
                    </g>
                  ))}
                </g>
              )}

              {/* corners you can join onto */}
              {(tool === "pen" || /^(pt|end):/.test(dragMode || "")) &&
                corners.map((c, i) => <circle key={i} cx={c.p[0]} cy={c.p[1]} r="7" fill="#ffffff" stroke="#28a1ab" strokeWidth="3" />)}

              {/* selection */}
              {box && (
                <g pointerEvents="none">
                  <polygon points={box.map((p) => p.join(",")).join(" ")} fill="none" stroke="#00c8b5" strokeWidth="4" strokeDasharray="14 10" />
                  <line x1={toFace(selected, 0, -selected.h / 2)[0]} y1={toFace(selected, 0, -selected.h / 2)[1]} x2={toFace(selected, 0, -selected.h / 2 - 70)[0]} y2={toFace(selected, 0, -selected.h / 2 - 70)[1]} stroke="#00c8b5" strokeWidth="4" />
                </g>
              )}
              {box && (
                <g>
                  <circle data-handle="rotate" cx={toFace(selected, 0, -selected.h / 2 - 70)[0]} cy={toFace(selected, 0, -selected.h / 2 - 70)[1]} r={H + 2} fill="#00c8b5" stroke="#ffffff" strokeWidth="5" className="cursor-grab" />
                  <rect data-handle="corner" x={cornerHandle[0] - H} y={cornerHandle[1] - H} width={H * 2} height={H * 2} rx="6" fill="#ffffff" stroke="#00c8b5" strokeWidth="5" className="cursor-nwse-resize" />
                  {selected.type !== "path" && <circle data-handle="side-x" cx={toFace(selected, selected.w / 2, 0)[0]} cy={toFace(selected, selected.w / 2, 0)[1]} r={H - 4} fill="#ffffff" stroke="#00c8b5" strokeWidth="5" className="cursor-ew-resize" />}
                  {selected.type !== "path" && <circle data-handle="side-y" cx={toFace(selected, 0, selected.h / 2)[0]} cy={toFace(selected, 0, selected.h / 2)[1]} r={H - 4} fill="#ffffff" stroke="#00c8b5" strokeWidth="5" className="cursor-ns-resize" />}
                </g>
              )}
              {selected?.type === "path" &&
                pathPoints(selected).map((p, i) => (
                  <circle key={i} data-handle={`pt:${i}`} data-testid="vertex-handle" cx={p[0]} cy={p[1]} r={H - 2} fill="#ffb238" stroke="#ffffff" strokeWidth="5" className="cursor-move" />
                ))}
              {selected && isLine(selected) &&
                lineEnds(selected).map((p, i) => (
                  <circle key={i} data-handle={`end:${i}`} cx={p[0]} cy={p[1]} r={H} fill="#ffb238" stroke="#ffffff" strokeWidth="5" className="cursor-move" />
                ))}

              {/* pen in progress */}
              {tool === "pen" && pen.length > 0 && (
                <g pointerEvents="none">
                  <polyline points={[...pen, ...(hover ? [hover.p] : [])].map((p) => p.join(",")).join(" ")} fill="none" stroke={color} strokeWidth="10" strokeLinejoin="round" strokeLinecap="round" opacity="0.9" />
                  {pen.map((p, i) => (
                    <circle key={i} cx={p[0]} cy={p[1]} r={i === 0 && pen.length >= 3 ? 22 : 12} fill={i === 0 ? "#ffb238" : "#ffffff"} stroke="#0e3238" strokeWidth="4" />
                  ))}
                </g>
              )}
              {tool === "pen" && hover && (
                <circle cx={hover.p[0]} cy={hover.p[1]} r={hover.kind === "corner" ? 20 : 10} fill="none" stroke={hover.kind === "corner" ? "#ffb238" : "#28a1ab"} strokeWidth="5" pointerEvents="none" />
              )}
            </svg>
          </div>

          {face.rotation ? <p className="hint text-center">{t("editorRotatedNote").replace("{deg}", face.rotation)}</p> : null}

          {/* contextual bar */}
          {tool === "pen" ? (
            <div className="rounded-2xl border border-line bg-surface-2 p-3 space-y-2 anim-rise">
              <p className="text-sm">{t("penHint")}</p>
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-soft" onClick={() => setPen(pen.slice(0, -1))} disabled={!pen.length}><Undo2 size={16} />{t("penUndo")}</button>
                <button className="btn btn-soft" onClick={() => finishPen(false)} disabled={pen.length < 2} data-testid="pen-finish-line"><Check size={16} />{t("penFinishLine")}</button>
                <button className="btn btn-primary" onClick={() => finishPen(true)} disabled={pen.length < 3} data-testid="pen-close"><Check size={16} />{t("penClose")}</button>
                <button className="btn btn-ghost ml-auto" onClick={() => { setPen([]); setTool("select"); }}><X size={16} />{t("penCancel")}</button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-line bg-surface-2 p-3 space-y-3">
              <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={t("fillColor")}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    role="radio"
                    aria-checked={(selected?.fill || color) === c}
                    aria-label={c}
                    onClick={() => pickColor(c)}
                    className={`w-8 h-8 rounded-lg border ${(selected?.fill || color) === c ? "ring-2 ring-mint ring-offset-2 ring-offset-surface-2 border-transparent" : "border-line"}`}
                    style={{ background: c }}
                  />
                ))}
                <label className="w-8 h-8 rounded-lg border border-line relative overflow-hidden cursor-pointer" style={{ background: "conic-gradient(#ff7a59,#ffb238,#9be15d,#00c8b5,#4f8ef7,#8b7cf6,#f7a8c4,#ff7a59)" }} title={t("customColor")}>
                  <input type="color" value={selected?.fill || color} onChange={(e) => pickColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label={t("customColor")} />
                </label>
              </div>

              {selected ? (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <span className="text-sm font-semibold mr-auto">{name(selected.type === "path" ? "path" : selected.type)}</span>
                  {lineStroke ? (
                    <label className="flex items-center gap-2 text-xs text-muted">
                      {t("thickness")}
                      <input type="range" className="mini w-28" min="4" max="60" step="1" value={selected.strokeWidth || 14} onChange={(e) => updateSelected({ strokeWidth: +e.target.value }, false)} onPointerUp={() => commit(draft)} />
                    </label>
                  ) : (
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <input type="checkbox" className="accent-[var(--mint)] w-4 h-4" checked={!!outlineOn} onChange={(e) => updateSelected(e.target.checked ? { stroke: "#0e3238", strokeWidth: selected.strokeWidth || 12 } : { stroke: null })} />
                      {t("outline")}
                      {outlineOn && <input type="range" className="mini w-24" min="2" max="48" step="1" value={selected.strokeWidth || 12} onChange={(e) => updateSelected({ strokeWidth: +e.target.value }, false)} onPointerUp={() => commit(draft)} aria-label={t("thickness")} />}
                    </label>
                  )}
                  <div className="flex">
                    <button className="btn btn-ghost btn-icon" onClick={() => restack(1)} title={t("bringForward")} aria-label={t("bringForward")}><BringToFront size={17} /></button>
                    <button className="btn btn-ghost btn-icon" onClick={() => restack(-1)} title={t("sendBackward")} aria-label={t("sendBackward")}><SendToBack size={17} /></button>
                    <button className="btn btn-ghost btn-icon" onClick={() => updateSelected((s) => ({ flipX: !s.flipX }))} title={t("flipShape")} aria-label={t("flipShape")}><FlipHorizontal size={17} /></button>
                    <button className="btn btn-ghost btn-icon" onClick={duplicate} title={t("duplicate")} aria-label={t("duplicate")}><CopyPlus size={17} /></button>
                    <button className="btn btn-ghost btn-icon hover:text-bad" onClick={removeSelected} title={t("deleteShape")} aria-label={t("deleteShape")} data-testid="delete-shape"><Trash2 size={17} /></button>
                  </div>
                </div>
              ) : (
                <p className="hint">{draft.length >= MAX_SHAPES ? t("shapesLimit") : draft.length ? t("editorPick") : t("editorEmpty")}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
