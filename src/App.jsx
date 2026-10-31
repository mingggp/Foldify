import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import MainLayout from "./components/layout/MainLayout";
import Scene from "./components/canvas/Scene";
import Box from "./components/canvas/Box";
import Sidebar from "./components/layout/Sidebar";
import ExportModal from "./components/ExportModal";
import { AuthProvider } from './contexts/AuthContext';
import { LanguageProvider, useLang } from './contexts/LanguageContext';
import { ToastProvider, useToast } from './contexts/ToastContext';
import AuthModal from './components/auth/AuthModal';
import GalleryModal from './components/gallery/GalleryModal';
import SettingsModal from './components/SettingsModal';
import { useHistory } from './hooks/useHistory';
import ShareModal from './components/share/ShareModal';
import QuizModal from './components/quiz/QuizModal';
import * as cubeQuiz from './lib/cubeQuiz';
import { drawShapes } from './lib/shapes';
import { layoutNet } from './lib/netGeometry';
import { VALID_CUBE_NETS } from './components/canvas/netsConfig';
import ShapeEditor from './components/editor/ShapeEditor';
import { parseShareLink, labelsToFaces } from './lib/shareLink';
import { makeLabelTexture } from './lib/labelTexture';
import { getBox } from './services/db';

const blankFace = () => ({ color: "#ffffff", textureUrl: null, aiImageUrl: null, userImageUrl: null, rotation: 0, flipX: false, flipY: false, shapes: [], activeShapeIndex: null });
const FACE_KEYS = ["bottom", "top", "front", "back", "left", "right"];

/** faces config with a label picture on every labelled face */
function facesFromLabels(faceLabels, base = {}) {
  const next = { ...base };
  for (const id of FACE_KEYS) {
    const l = faceLabels[id];
    if (!l) continue;
    next[id] = { ...blankFace(), textureUrl: l.label ? makeLabelTexture(l.label) : null, rotation: (l.turn || 0) * 90 };
  }
  return next;
}

// Read ?net=…&labels=… once, before the first render (see lib/shareLink.js).
const initialLink = typeof window !== "undefined" ? parseShareLink(window.location.search) : null;
const initialNet = initialLink && !initialLink.box ? initialLink : null;
const initialFaceLabels = initialNet ? labelsToFaces(initialNet.netIndex, initialNet.transform, initialNet.labels, initialNet.turns) : {};
/** localStorage can be blocked (private mode, school devices) — never let that break the app */
function readPref(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function writePref(key, value) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
const darkQuery = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function useSystemDark() {
  const query = darkQuery;
  const [dark, setDark] = useState(() => !!query?.matches);
  useEffect(() => {
    if (!query) return;
    const onChange = (e) => setDark(e.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [query]);
  return dark;
}

const hasLabels = (fl) => Object.values(fl || {}).filter((l) => l?.label).length >= 2;


function AppContent() {
  const { lang, setLang, t } = useLang();
  
  const [foldProgress, setFoldProgress] = useState(initialNet ? initialNet.fold : 0); // 0 to 1
  const [selectedFace, setSelectedFace] = useState(null);
  const [theme, setTheme] = useState(() => readPref("foldify.theme", "system")); // "system" | "light" | "dark"
  const systemDark = useSystemDark();
  const resolvedTheme = theme === "system" ? (systemDark ? "dark" : "light") : theme;
  const [showGrid, setShowGrid] = useState(true);
  const [showShadows, setShowShadows] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [activeNetId, setActiveNetId] = useState(initialNet ? initialNet.netIndex : 0); // Which of the 11 nets is active
  const [netFlipX, setNetFlipX] = useState(initialNet ? initialNet.transform.flipX : false);
  const [netFlipY, setNetFlipY] = useState(false);
  const [netRotation, setNetRotation] = useState(initialNet ? initialNet.transform.rotation : 0); // clockwise quarter turns of the net on paper
  const [showExportModal, setShowExportModal] = useState(false);
  const [isAutoRotate, setIsAutoRotate] = useState(false);
  
  // Settings & Navigation States
  const [sidebarPosition, setSidebarPosition] = useState(() => readPref("foldify.panel", "left")); // "left" | "right"
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Phase 8 States
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showGalleryModal, setShowGalleryModal] = useState(false);

  const [facesConfig, setFacesConfig, undoFaces, redoFaces, canUndo, canRedo] = useHistory(
    facesFromLabels(initialFaceLabels, Object.fromEntries(FACE_KEYS.map((k) => [k, blankFace()])))
  );

  // Labels typed in the Share dialog / read from a link: { faceId: { label, turn } }
  const [faceLabels, setFaceLabels] = useState(initialFaceLabels);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showShapeEditor, setShowShapeEditor] = useState(false);
  const toast = useToast();
  // Labels still on their faces (a face loses its label once its picture is replaced);
  // the turn follows the face's current rotation.
  const liveLabels = useMemo(() => {
    const out = {};
    for (const [id, l] of Object.entries(faceLabels)) {
      const face = facesConfig[id];
      if (!l?.label || !face || face.textureUrl !== makeLabelTexture(l.label)) continue;
      const r = ((face.rotation % 360) + 360) % 360;
      out[id] = { label: l.label, turn: r % 90 === 0 ? r / 90 : l.turn };
    }
    return out;
  }, [faceLabels, facesConfig]);
  const netTransform = useMemo(() => ({ rotation: netRotation, flipX: netFlipX, flipY: netFlipY }), [netRotation, netFlipX, netFlipY]);

  // ---- smooth folding animation (used by the quiz) ----
  const foldRef = useRef(foldProgress);
  const foldAnim = useRef(0);
  useEffect(() => { foldRef.current = foldProgress; }, [foldProgress]);
  useEffect(() => () => cancelAnimationFrame(foldAnim.current), []);
  const animateFold = useCallback((to, ms = 1400) => {
    cancelAnimationFrame(foldAnim.current);
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = foldRef.current;
    if (reduce || from === to) { setFoldProgress(to); return; }
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / ms);
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      setFoldProgress(from + (to - from) * eased);
      if (k < 1) foldAnim.current = requestAnimationFrame(step);
    };
    foldAnim.current = requestAnimationFrame(step);
  }, []);
  const setFoldByHand = useCallback((v) => { cancelAnimationFrame(foldAnim.current); setFoldProgress(v); }, []);
  const playFold = useCallback(() => animateFold(foldRef.current < 0.5 ? 1 : 0, 1500), [animateFold]);

  // Opening moment: fold the net up once and open it again, so the idea is clear at a glance.
  // Skipped for links (they ask for a specific state), reduced motion and automated tests.
  useEffect(() => {
    if (initialNet || initialLink?.box || navigator.webdriver) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timers = [setTimeout(() => animateFold(1, 1300), 450), setTimeout(() => animateFold(0, 1100), 2300)];
    return () => timers.forEach(clearTimeout);
  }, [animateFold]);

  // theme -> <html class="dark">, remembered between visits
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
    writePref("foldify.theme", theme);
  }, [theme, resolvedTheme]);
  useEffect(() => { writePref("foldify.panel", sidebarPosition); }, [sidebarPosition]);

  // ---- labels on squares ----
  const applyLabels = useCallback((netIndex, transform, labels, turns) => {
    const map = labelsToFaces(netIndex, transform, labels, turns);
    setActiveNetId(netIndex);
    setNetRotation(transform.rotation || 0);
    setNetFlipX(!!transform.flipX);
    setNetFlipY(!!transform.flipY);
    setFacesConfig((prev) => facesFromLabels(map, prev));
    setFaceLabels(map);
    return map;
  }, [setFacesConfig]);

  // a letter typed on one face in Decorate (drawn as the face's picture; turns with the picture)
  const setFaceLabel = useCallback((faceId, label) => {
    setFacesConfig((prev) => ({ ...prev, [faceId]: { ...prev[faceId], textureUrl: label ? makeLabelTexture(label) : null } }));
    setFaceLabels((prev) => {
      const next = { ...prev };
      if (label) next[faceId] = { label, turn: 0 };
      else delete next[faceId];
      return next;
    });
  }, [setFacesConfig]);

  // ---- guess before folding (exam-style question made from the current box) ----
  const [showQuiz, setShowQuiz] = useState(() => !!(initialNet?.quiz && hasLabels(initialFaceLabels)));
  const quizDesign = useMemo(
    () => (showQuiz ? { netIndex: activeNetId, transform: netTransform, facesConfig } : null),
    // the question is made once when the dialog opens; edits behind it don't matter
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [showQuiz]
  );
  const showFold = () => {
    setShowQuiz(false);
    setSelectedFace(null);
    cancelAnimationFrame(foldAnim.current);
    foldRef.current = 0;
    setFoldProgress(0);
    setTimeout(() => animateFold(1, 1800), 250);
  };

  const handleLoadBox = (savedData) => {
    if (savedData.facesConfig) setFacesConfig(savedData.facesConfig);
    if (savedData.activeNetId !== undefined) setActiveNetId(savedData.activeNetId);
    setNetFlipX(savedData.netFlipX || false);
    setNetFlipY(savedData.netFlipY || false);
    setNetRotation(savedData.netRotation || 0);
    setFaceLabels({});
    setFoldByHand(0); // reset fold so they can see net
  };

  // ?box=<id>: open a shared (public) box
  useEffect(() => {
    if (!initialLink?.box) return;
    let cancelled = false;
    getBox(initialLink.box)
      .then((box) => {
        if (cancelled) return;
        if (!box) return toast(t("boxLinkFailed"), "error");
        handleLoadBox(box);
        if (initialLink.fold) setFoldByHand(initialLink.fold);
        if (initialLink.quiz) setShowQuiz(true);
      })
      .catch(() => { if (!cancelled) toast(t("boxLinkFailed"), "error"); });
    return () => { cancelled = true; };
    // run once on start-up
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      applyLabels,
      cubeQuiz, drawShapes,
      layoutNet: (i, t) => layoutNet(VALID_CUBE_NETS[i], t),
      state: { foldProgress, activeNetId, netRotation, netFlipX, netFlipY, facesConfig, showLabels, faceLabels, showQuiz },
    });
  }, [foldProgress, activeNetId, netRotation, netFlipX, netFlipY, facesConfig, showLabels, setFacesConfig, faceLabels, showQuiz, applyLabels]);

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
        setFoldProgress={setFoldByHand}
        onPlayFold={playFold}
        faceLabels={liveLabels}
        onSetLabel={setFaceLabel}
        onOpenShapeEditor={() => { setSelectedFace((f) => f || "front"); setShowShapeEditor(true); }}
        onOpenShare={() => setShowShareModal(true)}
        onStartQuiz={() => { setSelectedFace(null); setShowQuiz(true); }}
        isQuizOpen={showQuiz}
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
            theme={resolvedTheme}
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
        {showExportModal && <ExportModal onClose={() => setShowExportModal(false)} showShadows={showShadows} />}
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
      {showShareModal && (
        <ShareModal
          onClose={() => setShowShareModal(false)}
          netIndex={activeNetId}
          transform={netTransform}
          faceLabels={liveLabels}
          facesConfig={facesConfig}
          labelOnly={FACE_KEYS.every((k) => {
            const f = facesConfig[k];
            return !f.shapes?.length && f.color === "#ffffff" && !f.flipX && !f.flipY && (!f.textureUrl || !!liveLabels[k]);
          })}
          onSignIn={() => setShowAuthModal(true)}
          foldProgress={foldProgress}
        />
      )}
      {showShapeEditor && selectedFace && (
        <ShapeEditor
          faceId={selectedFace}
          facesConfig={facesConfig}
          setFacesConfig={setFacesConfig}
          onPickFace={setSelectedFace}
          onClose={() => setShowShapeEditor(false)}
          undo={undoFaces}
          redo={redoFaces}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      )}
      {showQuiz && quizDesign && <QuizModal design={quizDesign} onClose={() => setShowQuiz(false)} onShowFold={showFold} />}
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
