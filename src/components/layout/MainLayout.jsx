import { useState } from "react";
import Sidebar from "./Sidebar";
import FoldDock from "./FoldDock";
import Logo from "../ui/Logo";
import { Focus, Menu, Rotate3D, QrCode, CircleHelp } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";

/**
 * App shell. ≥1024px (iPad landscape, PC): the tool panel is docked beside the 3D stage.
 * Narrower (iPad portrait, phones): the panel slides in over the stage.
 */
export default function MainLayout({ children, foldProgress, setFoldProgress, onPlayFold, sidebarPosition, onOpenShare, onStartQuiz, isQuizOpen, isAutoRotate, setIsAutoRotate, ...panelProps }) {
  const { t } = useLang();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const right = sidebarPosition === "right";

  const handleResetCamera = () => window.dispatchEvent(new CustomEvent("resetCamera"));

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden stage-bg">
      {/* 3D stage: right of the docked panel on large screens, full screen otherwise */}
      <main className={`absolute inset-y-0 ${right ? "left-0 right-0 lg:right-[364px]" : "right-0 left-0 lg:left-[364px]"}`}>
        {children}

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
          </div>
        </div>

        {/* fold control */}
        <div className="absolute bottom-4 inset-x-0 z-10 flex justify-center pointer-events-none px-4">
          <div className="pointer-events-auto">
            <FoldDock progress={foldProgress} onChange={setFoldProgress} onPlay={onPlayFold} />
          </div>
        </div>
      </main>

      {/* drawer backdrop (narrow screens) */}
      {isSidebarOpen && <div className="fixed inset-0 z-40 bg-[#03161a]/40 lg:hidden anim-fade" onClick={() => setIsSidebarOpen(false)} />}

      {/* tool panel */}
      <div
        className={`fixed lg:absolute inset-y-0 lg:inset-y-3 ${right ? "right-0 lg:right-3" : "left-0 lg:left-3"} z-50 lg:z-20 w-[352px] max-w-[92vw] transition-transform duration-300 ease-out lg:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : right ? "translate-x-full" : "-translate-x-full"
        } ${right ? "anim-sheet-right" : "anim-sheet-left"}`}
      >
        <Sidebar {...panelProps} quizOpen={isQuizOpen} closeSidebar={() => setIsSidebarOpen(false)} />
      </div>
    </div>
  );
}
