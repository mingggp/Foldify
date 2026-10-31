import { useEffect, useState } from "react";
import { ViewShiftContext } from "../canvas/viewShift";
import Sidebar from "./Sidebar";
import FoldDock from "./FoldDock";
import Logo from "../ui/Logo";
import { Focus, Menu, Rotate3D, QrCode, CircleHelp, Settings } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";

/**
 * App shell. ≥1024px (iPad landscape, PC): the tool panel is docked beside the 3D stage.
 * Narrower (iPad portrait, phones): the panel slides in over the stage.
 */
export default function MainLayout({ children, foldProgress, setFoldProgress, onPlayFold, sidebarPosition, onOpenShare, onStartQuiz, isQuizOpen, isAutoRotate, setIsAutoRotate, setShowSettingsModal, ...panelProps }) {
  const { t } = useLang();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const right = sidebarPosition === "right";
  // docked panel (≥1024px): the 3D view runs under the glass panel, picture shifted to the free side
  const [docked, setDocked] = useState(() => window.matchMedia?.("(min-width: 1024px)").matches ?? true);
  useEffect(() => {
    const q = window.matchMedia?.("(min-width: 1024px)");
    if (!q) return;
    const on = (e) => setDocked(e.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  const PANEL = 364; // 352 px panel + 12 px margin
  const viewShift = docked ? (right ? -PANEL / 2 : PANEL / 2) : 0;

  const handleResetCamera = () => window.dispatchEvent(new CustomEvent("resetCamera"));

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden stage-bg">
      {/* 3D stage: always full screen (it shows through the glass panel) */}
      <main className="absolute inset-0">
        <ViewShiftContext.Provider value={viewShift}>{children}</ViewShiftContext.Provider>
      </main>

      {/* controls over the stage, beside the docked panel */}
      <div className={`absolute inset-y-0 pointer-events-none ${right ? "left-0 right-0 lg:right-[364px]" : "right-0 left-0 lg:left-[364px]"}`}>
        {/* top bar */}
        <div className="absolute top-3 inset-x-3 z-10 flex items-start gap-2 pointer-events-none">
          <div className="lg:hidden pointer-events-auto flex items-center gap-2 glass rounded-2xl p-1 pr-3">
            <button onClick={() => setIsSidebarOpen(true)} className="btn btn-ghost btn-icon" aria-label={t("openTools")} data-testid="open-panel">
              <Menu size={20} />
            </button>
            <Logo size="sm" />
          </div>

          <div className="flex-1" />

          <div className="pointer-events-auto glass rounded-2xl p-1 flex items-center gap-1">
            <button onClick={onStartQuiz} disabled={isQuizOpen} data-testid="open-quiz" className="btn btn-ghost" title={t("quiz")}>
              <CircleHelp size={18} />
              <span className="hidden md:inline">{t("quiz")}</span>
            </button>
            <button onClick={onOpenShare} data-testid="open-share" className="btn btn-ghost" title={t("share")}>
              <QrCode size={18} />
              <span className="hidden md:inline">{t("share")}</span>
            </button>
            <span className="w-px h-6 bg-line mx-0.5" aria-hidden="true" />
            <button
              onClick={() => setIsAutoRotate(!isAutoRotate)}
              aria-pressed={isAutoRotate}
              className={`btn btn-icon ${isAutoRotate ? "btn-on" : "btn-ghost"}`}
              title={t("autoRotate")}
              aria-label={t("autoRotate")}
            >
              <Rotate3D size={18} className={isAutoRotate ? "animate-spin [animation-duration:3s]" : ""} />
            </button>
            <button onClick={handleResetCamera} className="btn btn-ghost btn-icon" title={t("resetCamera")} aria-label={t("resetCamera")}>
              <Focus size={18} />
            </button>
            <span className="hidden lg:block w-px h-6 bg-line mx-0.5" aria-hidden="true" />
            <button onClick={() => setShowSettingsModal(true)} className="hidden lg:inline-flex btn btn-ghost btn-icon" title={t("settings")} aria-label={t("settings")} data-testid="open-settings">
              <Settings size={18} />
            </button>
          </div>
        </div>

        {/* fold control */}
        <div className="absolute bottom-4 inset-x-0 z-10 flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto">
            <FoldDock progress={foldProgress} onChange={setFoldProgress} onPlay={onPlayFold} />
          </div>
        </div>
      </div>

      {/* drawer backdrop (narrow screens) */}
      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-[#03161a]/40 lg:hidden anim-fade" onClick={() => setIsSidebarOpen(false)} />}

      {/* tool panel */}
      <div
        className={`fixed lg:absolute inset-y-0 lg:inset-y-3 ${right ? "right-0 lg:right-3" : "left-0 lg:left-3"} z-50 lg:z-20 w-[352px] max-w-[92vw] transition-transform duration-300 ease-out lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : right ? "translate-x-full" : "-translate-x-full"
        } ${right ? "anim-sheet-right" : "anim-sheet-left"}`}
      >
        <Sidebar {...panelProps} setShowSettingsModal={setShowSettingsModal} quizOpen={isQuizOpen} closeSidebar={() => setIsSidebarOpen(false)} />
      </div>
    </div>
  );
}
