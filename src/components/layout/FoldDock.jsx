import { useLang } from "../../contexts/LanguageContext";

/** Net icon whose four arms fold in as `p` goes 0 → 1. */
function NetGlyph({ p }) {
  const k = 1 - 0.75 * p;
  const arm = (x, y, sx, sy, ox, oy) => (
    <rect x={x} y={y} width="6" height="6" rx="1.2" style={{ transformBox: "fill-box", transformOrigin: `${ox} ${oy}`, transform: `scale(${sx}, ${sy})` }} />
  );
  return (
    <svg viewBox="0 0 24 30" className="w-6 h-7" fill="currentColor" aria-hidden="true">
      <rect x="9" y="9" width="6" height="6" rx="1.2" />
      {arm(9, 2.5, 1, k, "center", "bottom")}
      {arm(2.5, 9, k, 1, "right", "center")}
      {arm(15.5, 9, k, 1, "left", "center")}
      {arm(9, 15.5, 1, k, "center", "top")}
      {arm(9, 22, 1, k, "center", "top")}
    </svg>
  );
}

function CubeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.8 20 7.2v9.6L12 21.2 4 16.8V7.2Z" fill="currentColor" fillOpacity="0.15" />
      <path d="M4 7.2 12 11.6 20 7.2M12 11.6v9.6" />
    </svg>
  );
}

/**
 * The fold control: a play button that folds / unfolds with an animation,
 * and a slider for doing it by hand.
 */
export default function FoldDock({ progress, onChange, onPlay }) {
  const { t } = useLang();
  const pct = Math.round(progress * 100);
  const folding = progress < 0.5;
  return (
    <div className="glass rounded-[22px] pl-2 pr-4 py-2 flex items-center gap-3 w-[min(560px,calc(100vw-2rem))]" data-testid="fold-dock">
      <button
        onClick={onPlay}
        className="btn btn-primary h-12 px-4 rounded-2xl text-[15px] shrink-0"
        data-testid="fold-play"
        aria-label={folding ? t("foldUp") : t("unfold")}
      >
        <svg viewBox="0 0 24 24" className={`w-5 h-5 transition-transform duration-500 ${folding ? "" : "rotate-180"}`} fill="currentColor" aria-hidden="true">
          <path d="M7 4.5v15l12-7.5z" />
        </svg>
        <span className="hidden sm:inline min-w-[4.5em] text-left">{folding ? t("foldUp") : t("unfold")}</span>
      </button>

      <span className={`transition-colors ${progress < 0.98 ? "text-brand-ink" : "text-muted"}`} title={t("net2d")}>
        <NetGlyph p={progress} />
      </span>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={progress}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        aria-label={t("foldAmount")}
        aria-valuetext={`${pct}%`}
        className="fold-range flex-1 min-w-0"
        style={{ "--p": `${pct}%`, "--p-num": progress }}
      />
      <span className={`transition-colors ${progress > 0.02 ? "text-brand-ink" : "text-muted"}`} title={t("box3d")}>
        <CubeGlyph />
      </span>
      <span className="font-display font-semibold tabular-nums text-sm w-10 text-right">{pct}%</span>
    </div>
  );
}
