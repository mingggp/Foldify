import React, { useState } from "react";
import Sidebar from "./Sidebar";
import { Focus, Menu, X, SlidersHorizontal, ArrowLeftRight, Rotate3D, Cuboid } from "lucide-react";

export default function MainLayout({ children, foldProgress, setFoldProgress, facesConfig, setFacesConfig, undoFaces, redoFaces, canUndo, canRedo, selectedFace, setSelectedFace, sidebarPosition, setShowSettingsModal, setShowExportModal, setExportImageBlob, setShowAuthModal, setShowGalleryModal, activeNetId, setActiveNetId, netFlipX, setNetFlipX, netFlipY, setNetFlipY, isAutoRotate, setIsAutoRotate }) {

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleResetCamera = () => {
    window.dispatchEvent(new CustomEvent('resetCamera'));
  };

  return (
    <div className={`flex h-[100dvh] w-screen bg-slate-50 dark:bg-slate-900 overflow-hidden ${sidebarPosition === 'right' ? 'md:flex-row-reverse' : 'md:flex-row'}`}>

      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        ></div>
      )}

      {/* Sidebar Tool Panel */}
      <div
        className={`fixed inset-y-0 ${sidebarPosition === 'right' ? 'right-0' : 'left-0'} z-50 transform transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : (sidebarPosition === 'right' ? 'translate-x-full' : '-translate-x-full')} shadow-2xl md:shadow-none h-full`}
      >
        <Sidebar
          facesConfig={facesConfig}
          setFacesConfig={setFacesConfig}
          undoFaces={undoFaces}
          redoFaces={redoFaces}
          canUndo={canUndo}
          canRedo={canRedo}
          selectedFace={selectedFace}
          setSelectedFace={setSelectedFace}
          activeNetId={activeNetId}
          setActiveNetId={setActiveNetId}
          netFlipX={netFlipX}
          setNetFlipX={setNetFlipX}
          netFlipY={netFlipY}
          setNetFlipY={setNetFlipY}
          onExport={(imgStr) => {
            setExportImageBlob(imgStr);
            setShowExportModal(true);
          }}
          setShowAuthModal={setShowAuthModal}
          setShowGalleryModal={setShowGalleryModal}
          setShowSettingsModal={setShowSettingsModal}
          closeSidebar={() => setIsSidebarOpen(false)}
        />
      </div>

      {/* Main 3D Canvas Section */}
      <main className="flex-1 relative flex flex-col min-w-0 h-full w-full">
        {/* Children will be the 3D Canvas */}
        {children}

        {/* Top-aligned Floating Controls */}
        <div className="absolute top-4 left-4 right-4 z-10 flex justify-between pointer-events-none">
          {/* Mobile Menu Button + Logo */}
          <div className="md:hidden pointer-events-auto flex items-center gap-2">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="flex items-center justify-center p-2.5 bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 backdrop-blur-md rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-slate-800/80 backdrop-blur-md rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
              <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                <Cuboid size={18} />
              </div>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">Foldify</span>
            </div>
          </div>

          <div className="flex-1"></div> {/* Spacer */}

          <div className="flex gap-2">
            <button
              onClick={() => setIsAutoRotate(!isAutoRotate)}
              className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg border transition-all font-medium text-xs md:text-sm shadow-sm ${isAutoRotate ? 'bg-indigo-500 text-white border-indigo-400' : 'bg-white/80 hover:bg-white text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700 backdrop-blur-sm'}`}
              title="หมุนอัตโนมัติ"
            >
              <Rotate3D size={16} className={isAutoRotate ? "animate-spin" : ""} style={{ animationDuration: '3s' }} />
              <span className="hidden md:inline">Auto Rotate</span>
            </button>

            <button
              onClick={handleResetCamera}
              className="pointer-events-auto flex items-center gap-2 bg-white/80 hover:bg-white text-slate-700 border-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 dark:text-slate-200 dark:border-slate-700 backdrop-blur-sm px-3 py-2 rounded-lg border transition-all font-medium text-xs md:text-sm shadow-sm"
            >
              <Focus size={16} />
              <span className="hidden md:inline">รีเซ็ตมุมกล้อง</span>
            </button>
          </div>
        </div>

        {/* Floating Bottom Folding Control */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-auto w-[90%] max-w-sm">
          <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-2xl p-4 shadow-2xl flex flex-col items-center gap-3">

            <div className="flex justify-between w-full items-center px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">2D Net</span>
              <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-black text-sm rounded-full">
                <SlidersHorizontal size={14} />
                {Math.round(foldProgress * 100)}%
              </div>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">3D Box</span>
            </div>

            <input
              type="range"
              min="0" max="1" step="0.01"
              value={foldProgress}
              onChange={(e) => setFoldProgress(parseFloat(e.target.value))}
              className="w-full accent-indigo-600 h-3 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer"
            />
          </div>
        </div>

      </main>
    </div>
  );
}
