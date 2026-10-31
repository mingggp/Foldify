import { useEffect, useRef, useState } from "react";
import { Download, ImageDown, Copy, Loader2 } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { useLang } from "../contexts/LanguageContext";
import Modal, { Segmented, Toggle, Range } from "./ui/Modal";

const RATIOS = { "1:1": 1, "4:3": 4 / 3, "16:9": 16 / 9 };
const LONG_SIDE = 2048; // output pixels on the long side — sharp enough to print on a worksheet

/**
 * Save a picture of the box, e.g. for an exam question.
 * The preview IS the exported picture (rendered by Scene's ExportRenderer with these options),
 * so what you see is what you get. Selection highlights are never included.
 */
const PREVIEW_SIDE = 1024; // live preview: drawn straight into a canvas, no PNG encoding

/** Ask the 3D scene (Scene.jsx ExportRenderer) to render once. target: a canvas to draw into, else a PNG URL comes back. */
function renderExport(detail) {
  return new Promise((resolve) => {
    const id = `${Date.now()}-${Math.random()}`;
    const onDone = (e) => {
      if (e.detail?.id !== id) return;
      window.removeEventListener("export-rendered", onDone);
      resolve(e.detail.url);
    };
    window.addEventListener("export-rendered", onDone);
    window.dispatchEvent(new CustomEvent("export-render", { detail: { ...detail, id } }));
  });
}

const clampZoom = (z) => Math.min(3, Math.max(0.5, z));

export default function ExportModal({ onClose, showShadows }) {
  const toast = useToast();
  const { t } = useLang();
  const [opts, setOpts] = useState({ view: "iso", ratio: "1:1", zoom: 1.8, grid: false, shadow: false, background: "white" });
  const [saving, setSaving] = useState(false);
  const preview = useRef(null);
  const frame = useRef(null);

  const set = (patch) => setOpts((o) => ({ ...o, ...patch }));
  const size = (side) => ({ width: side, height: Math.round(side / RATIOS[opts.ratio]) });
  const detail = (side) => ({ ...size(side), ...opts, shadow: opts.shadow && showShadows });

  // live preview: re-render on the next frame whenever an option changes
  useEffect(() => {
    const raf = requestAnimationFrame(() => {
      const c = preview.current;
      if (!c) return;
      const { width, height } = size(PREVIEW_SIDE);
      if (c.width !== width || c.height !== height) { c.width = width; c.height = height; }
      renderExport({ ...detail(PREVIEW_SIDE), target: c });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts, showShadows]);

  // mouse wheel / trackpad pinch over the picture zooms it (no page scroll)
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const step = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
      setOpts((o) => ({ ...o, zoom: clampZoom(o.zoom * step) }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // two-finger pinch on iPad
  const pinch = useRef(null);
  const pointers = useRef(new Map());
  const onPointer = (e) => {
    if (e.type === "pointerdown") pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    else if (e.type === "pointermove" && pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, [e.clientX, e.clientY]);
    else pointers.current.delete(e.pointerId);
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      const d = Math.hypot(pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]);
      if (pinch.current) setOpts((o) => ({ ...o, zoom: clampZoom(pinch.current.zoom * (d / pinch.current.d)) }));
      else pinch.current = { d, zoom: opts.zoom };
    } else pinch.current = null;
  };

  const fileName = `foldify-${opts.ratio.replace(":", "x")}.png`;

  const finalPicture = async () => {
    setSaving(true);
    try {
      return await renderExport(detail(LONG_SIDE));
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async () => {
    const url = await finalPicture();
    if (!url) return toast(t("exportFailed"), "error");
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast(t("exportSaved"), "success");
  };

  const handleCopy = async () => {
    try {
      const url = await finalPicture();
      const blob = await (await fetch(url)).blob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      toast(t("exportCopied"), "success");
    } catch (err) {
      console.error(err);
      toast(t("exportClipboardBlocked"), "error");
    }
  };

  const ratio = RATIOS[opts.ratio];
  return (
    <Modal
      title={t("exportTitle")}
      subtitle={t("exportHint")}
      icon={ImageDown}
      onClose={onClose}
      size="xl"
      z="z-[200]"
      testId="export"
      footer={
        <>
          <button onClick={handleCopy} disabled={saving} className="btn btn-soft h-11"><Copy size={17} />{t("exportCopy")}</button>
          <button onClick={handleDownload} disabled={saving} className="btn btn-primary h-11" data-testid="export-save">
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
            {t("exportSave")}
          </button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
        {/* preview = the exported picture */}
        <div
          ref={frame}
          className="relative grid place-items-center rounded-2xl bg-surface-2 border border-line p-3 touch-none cursor-zoom-in"
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerUp={onPointer}
          onPointerCancel={onPointer}
          title={t("exportWheel")}
        >
          <div className={`relative w-full ${opts.background === "white" ? "bg-white" : "checkered-bg"} shadow-sm`} style={{ aspectRatio: ratio, maxWidth: `min(100%, calc(58dvh * ${ratio}))` }}>
            <canvas ref={preview} width={PREVIEW_SIDE} height={PREVIEW_SIDE} className="absolute inset-0 w-full h-full" aria-label={t("exportPreview")} role="img" data-testid="export-preview" />
          </div>
          <span className="absolute bottom-2 right-3 text-[11px] text-muted pointer-events-none">{t("exportWheel")}</span>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-sm font-semibold">{t("exportView")}</span>
            <Segmented full value={opts.view} onChange={(v) => set({ view: v })} label={t("exportView")} options={[{ value: "iso", label: t("exportIso") }, { value: "current", label: t("exportCurrent") }]} />
          </div>
          <div className="space-y-2">
            <span className="text-sm font-semibold">{t("exportRatio")}</span>
            <Segmented full value={opts.ratio} onChange={(v) => set({ ratio: v })} label={t("exportRatio")} options={Object.keys(RATIOS).map((k) => ({ value: k, label: k }))} />
          </div>
          <label className="block space-y-1">
            <span className="flex justify-between text-sm font-semibold">{t("exportZoom")}<span className="text-muted tabular-nums font-normal">{Math.round(opts.zoom * 100)}%</span></span>
            <Range className="w-full" min={0.5} max={3} step={0.05} value={opts.zoom} onChange={(v) => set({ zoom: v })} aria-label={t("exportZoom")} data-testid="export-zoom" />
          </label>
          <div className="space-y-2">
            <span className="text-sm font-semibold">{t("exportBackground")}</span>
            <Segmented full value={opts.background} onChange={(v) => set({ background: v })} label={t("exportBackground")} options={[{ value: "white", label: t("exportWhite") }, { value: "transparent", label: t("exportTransparent") }]} />
          </div>
          <div>
            <Toggle label={t("exportGrid")} checked={opts.grid} onChange={(v) => set({ grid: v })} testId="export-grid" />
            {showShadows && <Toggle label={t("exportShadow")} checked={opts.shadow} onChange={(v) => set({ shadow: v })} />}
          </div>
        </div>
      </div>

      <style>{`
        .checkered-bg {
          background-color: #ffffff;
          background-image:
            linear-gradient(45deg, #e6ecec 25%, transparent 25%),
            linear-gradient(-45deg, #e6ecec 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #e6ecec 75%),
            linear-gradient(-45deg, transparent 75%, #e6ecec 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
      `}</style>
    </Modal>
  );
}
