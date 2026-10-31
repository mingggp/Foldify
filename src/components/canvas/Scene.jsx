import { useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Grid, Lightformer } from "@react-three/drei";
import * as THREE from 'three';
import { analyzeNetImage } from "../../utils/SmartNetAnalyzer";
import { useToast } from "../../contexts/ToastContext";
import { useLang } from "../../contexts/LanguageContext";
import CustomCameraControls from "./CustomCameraControls";
import Box from "./Box";

// Dev/test-only: expose the three.js scene to the Playwright tests.
function TestBridge() {
  const { scene, camera, gl, invalidate, size } = useThree();
  useEffect(() => {
    const hook = (window.__foldify = window.__foldify || {});
    hook.three = { scene, camera, gl, invalidate, size, THREE };
  }, [scene, camera, gl, invalidate, size]);
  return null;
}

/**
 * Export renderer: on an "export-render" request, draws the box once with an export
 * camera into the canvas at the export size, grabs it, and puts everything back — all in
 * one synchronous step, so nothing ever flashes on screen. Selection highlights are
 * hidden; grid / floor shadow / background follow the export options.
 */
const HOME_DIR = new THREE.Vector3(1, 1, 1).normalize();
const TARGET = new THREE.Vector3(0, 1, 0);

function ExportRenderer() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const onRender = (e) => {
      const { id, width, height, zoom = 1, view = "current", grid = false, shadow = true, background = "transparent", target = null } = e.detail || {};
      const cam = camera.clone();
      if (view === "iso") {
        cam.position.copy(TARGET).addScaledVector(HOME_DIR, 13.5);
        cam.up.set(0, 1, 0);
        cam.lookAt(TARGET);
      }
      cam.aspect = width / height;
      cam.zoom = zoom;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);

      // set visibility for the export, remember what to put back
      const changed = [];
      scene.traverse((o) => {
        let want = o.visible;
        if (o.name === "selection-glow" || o.name === "highlight-edge") want = false;
        else if (o.name === "floor-grid") want = grid;
        else if (o.name === "floor-shadow") want = shadow && o.visible;
        if (want !== o.visible) { changed.push([o, o.visible]); o.visible = want; }
      });
      const prevSize = gl.getSize(new THREE.Vector2());
      const prevRatio = gl.getPixelRatio();
      const prevClear = gl.getClearColor(new THREE.Color());
      const prevAlpha = gl.getClearAlpha();
      let url = null;
      try {
        gl.setPixelRatio(1);
        gl.setSize(width, height, false);
        gl.setClearColor(0xffffff, background === "white" ? 1 : 0);
        gl.clear();
        gl.render(scene, cam);
        if (target) {
          // live preview: copy straight into the given canvas (no PNG encoding — fast)
          const ctx = target.getContext("2d");
          ctx.clearRect(0, 0, target.width, target.height);
          ctx.drawImage(gl.domElement, 0, 0, width, height, 0, 0, target.width, target.height);
        } else {
          url = gl.domElement.toDataURL("image/png");
        }
      } finally {
        changed.forEach(([o, v]) => { o.visible = v; });
        gl.setPixelRatio(prevRatio);
        gl.setSize(prevSize.x, prevSize.y, false);
        gl.setClearColor(prevClear, prevAlpha);
        gl.render(scene, camera);
      }
      window.dispatchEvent(new CustomEvent("export-rendered", { detail: { id, url } }));
    };
    window.addEventListener("export-render", onRender);
    return () => window.removeEventListener("export-render", onRender);
  }, [gl, scene, camera]);
  return null;
}

function CanvasDropHandler({ setFacesConfig, setActiveNetId, setNetFlipX, setNetFlipY, setNetRotation }) {
  const { camera, scene, raycaster } = useThree();
  const toast = useToast();
  const { t } = useLang();

  useEffect(() => {
    const handleDragOver = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';
    };

    const handleDrop = async (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
      const file = e.dataTransfer.files[0];
      if (!file.type.startsWith('image/')) {
        toast(t('dropImageOnly'), 'error');
        return;
      }

      // Check if dropped on a face
      const rect = e.target.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      const mouse = new THREE.Vector2();
      mouse.x = (clientX / rect.width) * 2 - 1;
      mouse.y = -(clientY / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);

      const faceHit = intersects.find(hit => hit.object.userData && hit.object.userData.faceId);

      if (faceHit) {
        // Option 1: Dropped exactly on a face -> update that face's texture only
        const faceId = faceHit.object.userData.faceId;
        const imageUrl = URL.createObjectURL(file);
        setFacesConfig(prev => ({
          ...prev,
          [faceId]: { ...prev[faceId], textureUrl: imageUrl }
        }));
      } else {
        // Option 2: Dropped on background -> Try Smart Net Analysis
        try {
          // You could show a quick loading toast here
          const result = await analyzeNetImage(file);
          // Apply results
          setActiveNetId(result.activeNetId);
          setNetFlipX(result.netFlipX);
          setNetFlipY(result.netFlipY);
          setNetRotation?.(result.netRotation);

          setFacesConfig(prev => {
            const next = { ...prev };
            for (const face of ['top', 'bottom', 'left', 'right', 'front', 'back']) {
              if (result.extractedFaces[face]) {
                next[face] = { ...next[face], textureUrl: result.extractedFaces[face] };
              }
            }
            return next;
          });

          toast(t('scanDone'), 'success');

        } catch {
          toast(t('scanDropFailed'), 'error');
        }
      }
    };

    const canvasDOM = window.document.querySelector('canvas');
    if (canvasDOM) {
      canvasDOM.addEventListener('dragover', handleDragOver);
      canvasDOM.addEventListener('drop', handleDrop);
    }

    return () => {
      if (canvasDOM) {
        canvasDOM.removeEventListener('dragover', handleDragOver);
        canvasDOM.removeEventListener('drop', handleDrop);
      }
    };
  }, [camera, scene, raycaster, setFacesConfig, setActiveNetId, setNetFlipX, setNetFlipY, setNetRotation, toast, t]);

  return null;
}

export default function Scene({ children, theme, showGrid, showShadows, isAutoRotate, setFacesConfig, setActiveNetId, setNetFlipX, setNetFlipY, setNetRotation }) {
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [7.8, 8.8, 7.8], fov: 45 }} shadows={showShadows} gl={{ preserveDrawingBuffer: true, alpha: true }}>
        <ExportRenderer />
        {import.meta.env.DEV && <TestBridge />}
        
        {/* No scene background: the canvas is transparent so the page's teal stage shows through
            (and exported snapshots come out with a transparent background). */}
        <ambientLight intensity={showShadows ? 0.5 : 1} />
        {showShadows && (
          <directionalLight
            position={[10, 10, 5]}
            intensity={1.5}
            castShadow
            shadow-mapSize={1024}
          />
        )}
        {/* Reflections come from a tiny studio built in-scene — no HDR download from a CDN,
            so the scene still renders offline / behind school firewalls. */}
        <Environment resolution={64} frames={1}>
          <Lightformer intensity={2} position={[0, 5, -5]} scale={[10, 5, 1]} />
          <Lightformer intensity={1} position={[-5, 2, 3]} rotation-y={Math.PI / 2} scale={[8, 4, 1]} />
          <Lightformer intensity={1} position={[5, 2, 3]} rotation-y={-Math.PI / 2} scale={[8, 4, 1]} />
          <Lightformer intensity={0.6} position={[0, -4, 0]} rotation-x={-Math.PI / 2} scale={[10, 10, 1]} color="#94a3b8" />
        </Environment>

        {setFacesConfig && (
          <CanvasDropHandler
            setFacesConfig={setFacesConfig}
            setActiveNetId={setActiveNetId}
            setNetFlipX={setNetFlipX}
            setNetFlipY={setNetFlipY}
            setNetRotation={setNetRotation}
          />
        )}

        {/* Scene Objects */}
        {children}

        {/* Floor and Grid */}
        {/* always mounted (hidden when off) so a picture export can still include it */}
        {(
          <Grid
            name="floor-grid"
            visible={showGrid}
            infiniteGrid
            fadeDistance={40}
            sectionThickness={1.2}
            cellThickness={0.8}
            sectionColor={theme === 'dark' ? "#30383b" : "#8fc3c2"}
            cellColor={theme === 'dark' ? "#1d2225" : "#c3dedd"}
            position={[0, -0.02, 0]}
          />
        )}

        {showShadows && (
          <mesh name="floor-shadow" rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
            <planeGeometry args={[100, 100]} />
            <shadowMaterial transparent opacity={theme === 'dark' ? 0.45 : 0.22} color={theme === 'dark' ? '#000000' : '#0b4a50'} />
          </mesh>
        )}

        {/* Controls — custom: 1-finger orbit, 2-finger trackball+zoom */}
        <CustomCameraControls
          target={[0, 1, 0]}
          minDistance={3}
          maxDistance={20}
          orbitSpeed={0.006}
          trackballSpeed={2.0}
          isAutoRotate={isAutoRotate}
        />
      </Canvas>
    </div>
  );
}
