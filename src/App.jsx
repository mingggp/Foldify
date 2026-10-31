import { useState, useEffect } from "react";
import MainLayout from "./components/layout/MainLayout";
import Scene from "./components/canvas/Scene";
import Box from "./components/canvas/Box";
import Sidebar from "./components/layout/Sidebar";
import ExportModal from "./components/ExportModal";
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider, useLang } from './contexts/LanguageContext';
import { ToastProvider } from './contexts/ToastContext';
import AuthModal from './components/auth/AuthModal';
import GalleryModal from './components/gallery/GalleryModal';
import SettingsModal from './components/SettingsModal';
import { useHistory } from './hooks/useHistory';

function AppContent() {
  const { lang, setLang } = useLang();
  
  const [foldProgress, setFoldProgress] = useState(0); // 0 to 1
  const [selectedFace, setSelectedFace] = useState("front");
  const [theme, setTheme] = useState("dark");
  const [showGrid, setShowGrid] = useState(true);
  const [showShadows, setShowShadows] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [activeNetId, setActiveNetId] = useState(0); // Which of the 11 nets is active
  const [netFlipX, setNetFlipX] = useState(false);
  const [netFlipY, setNetFlipY] = useState(false);
  const [netRotation, setNetRotation] = useState(0); // clockwise quarter turns of the net on paper
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportImageBlob, setExportImageBlob] = useState(null);
  const [isAutoRotate, setIsAutoRotate] = useState(false);
  
  // Settings & Navigation States
  const [sidebarPosition, setSidebarPosition] = useState("left"); // "left" | "right"
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Phase 8 States
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);

  const [facesConfig, setFacesConfig, undoFaces, redoFaces, canUndo, canRedo] = useHistory({
    bottom: { color: "#ffffff", textureUrl: null, aiImageUrl: null, userImageUrl: null, rotation: 0, flipX: false, flipY: false, shapes: [], activeShapeIndex: null },
    top: { color: "#ffffff", textureUrl: null, aiImageUrl: null, userImageUrl: null, rotation: 0, flipX: false, flipY: false, shapes: [], activeShapeIndex: null },
    front: { color: "#ffffff", textureUrl: null, aiImageUrl: null, userImageUrl: null, rotation: 0, flipX: false, flipY: false, shapes: [], activeShapeIndex: null },
    back: { color: "#ffffff", textureUrl: null, aiImageUrl: null, userImageUrl: null, rotation: 0, flipX: false, flipY: false, shapes: [], activeShapeIndex: null },
    left: { color: "#ffffff", textureUrl: null, aiImageUrl: null, userImageUrl: null, rotation: 0, flipX: false, flipY: false, shapes: [], activeShapeIndex: null },
    right: { color: "#ffffff", textureUrl: null, aiImageUrl: null, userImageUrl: null, rotation: 0, flipX: false, flipY: false, shapes: [], activeShapeIndex: null },
  });

  const handleLoadBox = (savedData) => {
    if (savedData.facesConfig) setFacesConfig(savedData.facesConfig);
    if (savedData.activeNetId !== undefined) setActiveNetId(savedData.activeNetId);
    setNetFlipX(savedData.netFlipX || false);
    setNetFlipY(savedData.netFlipY || false);
    setNetRotation(savedData.netRotation || 0);
    setFoldProgress(0); // reset fold so they can see net
  };

  // Dev/test-only hook used by the Playwright tests (tests/e2e). Stripped from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const hook = (window.__foldify = window.__foldify || {});
    Object.assign(hook, {
      setFoldProgress, setActiveNetId, setFacesConfig, setSelectedFace, setShowLabels, setShowGrid, setShowShadows, setTheme, setIsAutoRotate,
      setNetTransform: ({ rotation = 0, flipX = false, flipY = false } = {}) => {
        setNetRotation(rotation);
        setNetFlipX(flipX);
        setNetFlipY(flipY);
      },
      state: { foldProgress, activeNetId, netRotation, netFlipX, netFlipY, facesConfig, showLabels },
    });
  }, [foldProgress, activeNetId, netRotation, netFlipX, netFlipY, facesConfig, showLabels, setFacesConfig]);

  // Keyboard listener for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) redoFaces();
        else undoFaces();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoFaces, redoFaces]);

  return (
    <>
      <MainLayout 
        foldProgress={foldProgress} 
        setFoldProgress={setFoldProgress}
        facesConfig={facesConfig}
        setFacesConfig={setFacesConfig}
        undoFaces={undoFaces}
        redoFaces={redoFaces}
        canUndo={canUndo}
        canRedo={canRedo}
        selectedFace={selectedFace}
        setSelectedFace={setSelectedFace}
        sidebarPosition={sidebarPosition}
        setShowSettingsModal={setShowSettingsModal}
        setShowExportModal={setShowExportModal}
        setExportImageBlob={setExportImageBlob}
        setShowAuthModal={setShowAuthModal}
        setShowGalleryModal={setShowGalleryModal}
        activeNetId={activeNetId}
        setActiveNetId={setActiveNetId}
        netFlipX={netFlipX}
        setNetFlipX={setNetFlipX}
        netFlipY={netFlipY}
        setNetFlipY={setNetFlipY}
        netRotation={netRotation}
        setNetRotation={setNetRotation}
        isAutoRotate={isAutoRotate}
        setIsAutoRotate={setIsAutoRotate}
        >
          <Scene 
            foldProgress={foldProgress} 
            facesConfig={facesConfig} 
            setFacesConfig={setFacesConfig}
            selectedFace={selectedFace}
            setSelectedFace={setSelectedFace}
            setActiveNetId={setActiveNetId}
            setNetFlipX={setNetFlipX}
            setNetFlipY={setNetFlipY}
            setNetRotation={setNetRotation}
            theme={theme}
            showGrid={showGrid}
            showShadows={showShadows}
            isAutoRotate={isAutoRotate}
          >
          <Box 
            foldProgress={foldProgress} 
            facesConfig={facesConfig} 
            selectedFace={selectedFace} 
            setSelectedFace={setSelectedFace}
            showShadows={showShadows}
            activeNetId={activeNetId}
            netFlipX={netFlipX}
            netFlipY={netFlipY}
            netRotation={netRotation}
            showLabels={showLabels}
          />
        </Scene>
        {showExportModal && (
          <ExportModal 
            exportImageBlob={exportImageBlob} 
            onClose={() => setShowExportModal(false)}
          />
        )}
      </MainLayout>

      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)}
        theme={theme} setTheme={setTheme}
        showGrid={showGrid} setShowGrid={setShowGrid}
        showShadows={showShadows} setShowShadows={setShowShadows}
        showLabels={showLabels} setShowLabels={setShowLabels}
        sidebarPosition={sidebarPosition} setSidebarPosition={setSidebarPosition}
        lang={lang} setLang={setLang}
      />
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      <GalleryModal isOpen={showGalleryModal} onClose={() => setShowGalleryModal(false)} onLoadBox={handleLoadBox} />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <LanguageProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

export default App;
