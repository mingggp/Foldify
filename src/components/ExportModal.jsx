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
export default function ExportModal({ onClose, showShadows }) {
  const toast = useToast();
  const { t } = useLang();
  const [opts, setOpts] = useState({ view: "iso", ratio: "1:1", zoom: 1.8, grid: false, shadow: false, background: "white" });
  const [url, setUrl] = useState(null);
  const [busy, setBusy] = useState(true);
  const reqId = useRef(0);

  const set = (patch) => setOpts((o) => ({ ...o, ...patch }));

  // ask the 3D scene for a fresh render whenever an option changes (debounced for the slider)
  useEffect(() => {
    const id = ++reqId.current;
    const r = RATIOS[opts.ratio];
    const width = LONG_SIDE;
    const height = Math.round(LONG_SIDE / r);
    const onDone = (e) => {
      if (e.detail?.id !== id) return;
      setUrl(e.detail.url);
      setBusy(false);
    };
    window.addEventListener("export-rendered", onDone);
    const timer = setTimeout(() => {
      setBusy(true);
      window.dispatchEvent(new CustomEvent("export-render", { detail: { id, width, height, ...opts, shadow: opts.shadow && showShadows } }));
    }, 120);
    return () => { clearTimeout(timer); window.removeEventListener("export-rendered", onDone); };
  }, [opts, showShadows]);

  const fileName = `foldify-${opts.ratio.replace(":", "x")}.png`;

  const handleDownload = () => {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    toast(t("exportSaved"), "success");
  };

  const handleCopy = async () => {
    if (!url) return;
    try {
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
          <button onClick={handleCopy} disabled={!url || busy} className="btn btn-soft h-11"><Copy size={17} />{t("exportCopy")}</button>
          <button onClick={handleDownload} disabled={!url || busy} className="btn btn-primary h-11" data-testid="export-save"><Download size={17} />{t("exportSave")}</button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
        {/* preview = the exported picture */}
        <div className="relative grid place-items-center rounded-2xl bg-surface-2 border border-line p-3">
          <div className={`relative w-full ${opts.background === "white" ? "bg-white" : "checkered-bg"} shadow-sm`} style={{ aspectRatio: ratio, maxWidth: `min(100%, calc(58dvh * ${ratio}))` }}>
            {url && <img src={url} alt={t("exportPreview")} className="absolute inset-0 w-full h-full" data-testid="export-preview" />}
          </div>
          {busy && <Loader2 size={26} className="absolute animate-spin text-mint" />}
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
