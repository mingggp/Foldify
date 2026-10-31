import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";

/**
 * A 5-second looping how-to for Smart Scan, drawn with CSS (no video file):
 * snip a net from a worksheet → it goes into the Scan button → the net folds into a box.
 */
export function ScanDemo() {
  const s = 26; // square size (px)
  const sq = (label, extra = {}) => ({
    position: "absolute",
    width: s,
    height: s,
    display: "grid",
    placeItems: "center",
    font: "700 13px var(--font-display)",
    color: "#06302f",
    background: "#e6faf8",
    border: "1.5px solid #28a1ab",
    borderRadius: 3,
    transformStyle: "preserve-3d",
    ...extra,
    "--label": `"${label}"`,
  });
  return (
    <div className="sd-stage" aria-hidden="true">
      <style>{`
        .sd-stage { position: relative; width: 264px; height: 150px; overflow: hidden; border-radius: 14px;
          background: radial-gradient(120px 80px at 75% 40%, rgb(0 200 181 / .14), transparent 70%), var(--surface-2); }
        .sd-sheet { position: absolute; left: 14px; top: 14px; width: 104px; height: 122px; background: #fff; border-radius: 6px;
          box-shadow: 0 4px 12px -4px rgb(0 0 0 / .25); animation: sd-sheet 5s infinite; }
        .sd-line { position: absolute; left: 10px; height: 4px; border-radius: 2px; background: #d9e2e2; }
        .sd-mini { position: absolute; left: 32px; top: 40px; width: 42px; height: 56px; }
        .sd-mini i { position: absolute; width: 14px; height: 14px; border: 1.5px solid #0e3238; background: #fff; box-sizing: border-box; }
        .sd-snip { position: absolute; left: 26px; top: 34px; width: 54px; height: 68px; border: 2px dashed #ffb238; border-radius: 4px;
          clip-path: inset(0 100% 100% 0); animation: sd-snip 5s infinite; }
        .sd-fly { position: absolute; left: 40px; top: 48px; width: 42px; height: 56px; border-radius: 4px; background: #fff;
          box-shadow: 0 0 0 2px #ffb238; opacity: 0; animation: sd-fly 5s infinite; }
        .sd-btn { position: absolute; left: 22px; bottom: 10px; height: 22px; padding: 0 9px; border-radius: 999px; display: flex; gap: 5px; align-items: center;
          font: 600 10px var(--font-sans); color: #06302f; background: linear-gradient(135deg, #00d5c9, #00c8b5); opacity: 0; animation: sd-btn 5s infinite; }
        .sd-cursor { position: absolute; width: 0; height: 0; border-left: 7px solid #0e3238; border-top: 4px solid transparent; border-bottom: 4px solid transparent;
          transform: rotate(-60deg); left: 70px; bottom: 6px; opacity: 0; animation: sd-cursor 5s infinite; }
        .sd-scene { position: absolute; left: 172px; top: 58px; perspective: 420px; opacity: 0; animation: sd-show 5s infinite; }
        .sd-cube { position: relative; transform-style: preserve-3d; animation: sd-turn 5s infinite; }
        .sd-cube > div, .sd-cube div div { animation-duration: 5s; animation-iteration-count: infinite; }
        .sd-top { transform-origin: 50% 100%; animation-name: sd-top; }
        .sd-bottom { transform-origin: 50% 0; animation-name: sd-bottom; }
        .sd-left { transform-origin: 100% 50%; animation-name: sd-left; }
        .sd-right { transform-origin: 0 50%; animation-name: sd-right; }
        .sd-lid { transform-origin: 50% 0; animation-name: sd-lid; }
        @keyframes sd-sheet { 0%, 40% { opacity: 1; transform: none; } 50%, 92% { opacity: .35; transform: scale(.94); } 100% { opacity: 1; transform: none; } }
        @keyframes sd-snip { 0% { clip-path: inset(0 100% 100% 0); } 14%, 34% { clip-path: inset(0 0 0 0); } 40%, 100% { clip-path: inset(0 0 0 0); opacity: 0; } }
        @keyframes sd-fly { 0%, 24% { opacity: 0; transform: none; } 28% { opacity: 1; transform: translate(0, 0) scale(1); }
          42% { opacity: 1; transform: translate(-6px, 58px) scale(.3); } 46%, 100% { opacity: 0; transform: translate(-6px, 58px) scale(.2); } }
        @keyframes sd-btn { 0%, 18% { opacity: 0; transform: translateY(6px); } 24%, 40% { opacity: 1; transform: none; }
          43% { opacity: 1; transform: scale(1.12); } 47%, 86% { opacity: 1; transform: none; } 94%, 100% { opacity: 0; } }
        @keyframes sd-cursor { 0%, 26% { opacity: 0; transform: translate(14px, 10px) rotate(-60deg); } 34% { opacity: 1; transform: translate(0, 0) rotate(-60deg); }
          42% { opacity: 1; transform: translate(0, 1px) rotate(-60deg) scale(.85); } 50%, 100% { opacity: 0; } }
        @keyframes sd-show { 0%, 44% { opacity: 0; } 50%, 94% { opacity: 1; } 100% { opacity: 0; } }
        @keyframes sd-turn { 0%, 58% { transform: rotateX(0) rotateY(0); } 88%, 100% { transform: rotateX(-30deg) rotateY(-40deg); } }
        @keyframes sd-top { 0%, 60% { transform: rotateX(0); } 80%, 100% { transform: rotateX(90deg); } }
        @keyframes sd-bottom { 0%, 60% { transform: rotateX(0); } 80%, 100% { transform: rotateX(-90deg); } }
        @keyframes sd-left { 0%, 60% { transform: rotateY(0); } 80%, 100% { transform: rotateY(-90deg); } }
        @keyframes sd-right { 0%, 60% { transform: rotateY(0); } 80%, 100% { transform: rotateY(90deg); } }
        @keyframes sd-lid { 0%, 66% { transform: rotateX(0); } 86%, 100% { transform: rotateX(-90deg); } }
        @media (prefers-reduced-motion: reduce) { .sd-stage * { animation: none !important; opacity: 1 !important; } .sd-snip, .sd-fly, .sd-cursor { display: none; } }
      `}</style>

      <div className="sd-sheet">
        <span className="sd-line" style={{ top: 10, width: 70 }} />
        <span className="sd-line" style={{ top: 20, width: 52 }} />
        <div className="sd-mini">
          <i style={{ left: 14, top: 0 }} /><i style={{ left: 0, top: 14 }} /><i style={{ left: 14, top: 14 }} /><i style={{ left: 28, top: 14 }} /><i style={{ left: 14, top: 28 }} /><i style={{ left: 14, top: 42 }} />
        </div>
        <span className="sd-line" style={{ top: 106, width: 80 }} />
        <div className="sd-snip" />
      </div>
      <div className="sd-fly" />
      <div className="sd-btn">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10" /></svg>
        Scan
      </div>
      <div className="sd-cursor" />

      <div className="sd-scene">
        <div className="sd-cube">
          <div style={sq("F")}>F
            <div className="sd-top" style={sq("T", { left: -1.5, top: -s })}>T</div>
            <div className="sd-left" style={sq("L", { left: -s, top: -1.5 })}>L</div>
            <div className="sd-right" style={sq("R", { left: s - 3, top: -1.5 })}>R</div>
            <div className="sd-bottom" style={sq("B", { left: -1.5, top: s - 3 })}>B
              <div className="sd-lid" style={sq("K", { left: -1.5, top: s - 3 })}>K</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ⓘ button next to Smart Scan: shows the demo on hover (mouse) or tap (iPad). */
export default function ScanHelp() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btn = useRef(null);
  const pop = useRef(null);
  const hoverTimer = useRef(0);
  const lastPointer = useRef("mouse");

  useLayoutEffect(() => {
    if (!open || !btn.current) return;
    const place = () => {
      const r = btn.current.getBoundingClientRect();
      const w = 300;
      const roomRight = window.innerWidth - r.right - 16;
      const left = roomRight >= w + 12 ? r.right + 12 : r.left - w - 12 >= 8 ? r.left - w - 12 : Math.max(8, Math.min(window.innerWidth - w - 8, r.left - w / 2));
      const below = roomRight < w + 12 && r.left - w - 12 < 8;
      setPos({ left, top: below ? r.bottom + 8 : Math.max(8, r.top - 12), width: w });
    };
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const away = (e) => { if (!pop.current?.contains(e.target) && !btn.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", away);
    window.addEventListener("keydown", esc);
    return () => { document.removeEventListener("pointerdown", away); window.removeEventListener("keydown", esc); };
  }, [open]);

  const enter = (e) => { if (e.pointerType === "mouse") { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setOpen(true), 250); } };
  const leave = (e) => { if (e.pointerType === "mouse") { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setOpen(false), 200); } };

  return (
    <>
      <button
        ref={btn}
        type="button"
        // mouse: hover opens / closes, a click just keeps it open; touch: tap toggles
        onClick={() => setOpen((o) => (lastPointer.current === "mouse" ? true : !o))}
        onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
        onPointerEnter={enter}
        onPointerLeave={leave}
        aria-expanded={open}
        aria-label={t("scanHow")}
        title={t("scanHow")}
        data-testid="scan-help"
        className="btn btn-ghost btn-icon min-h-8 min-w-8 w-8 h-8 rounded-full text-brand-ink"
      >
        <Info size={17} />
      </button>
      {open && pos && createPortal(
        <div
          ref={pop}
          role="dialog"
          aria-label={t("scanHow")}
          onPointerEnter={enter}
          onPointerLeave={leave}
          className="fixed z-[120] glass rounded-2xl p-3 space-y-3 anim-rise"
          style={{ left: pos.left, top: pos.top, width: pos.width }}
          data-testid="scan-help-pop"
        >
          <ScanDemo />
          <ol className="space-y-1.5 text-sm">
            {[t("scanStep1"), t("scanStep2"), t("scanStep3")].map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-5 h-5 shrink-0 rounded-full bg-mint/20 text-brand-ink grid place-items-center text-xs font-bold">{i + 1}</span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          <p className="hint">{t("scanTip")}</p>
        </div>,
        // portal: the panel's glass (backdrop-filter) would otherwise clip a fixed popover
        document.body
      )}
    </>
  );
}
