import React, { useRef, useEffect, useState, useCallback } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
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

// Simple helper that lives inside R3F context and can directly access gl
function SnapshotCapture({ onCapture }) {
  const { gl } = useThree();
  const pendingCapture = useRef(false);

  useEffect(() => {
    const handleCapture = () => {
      pendingCapture.current = true;
    };
    window.addEventListener('trigger-snapshot-frame', handleCapture);
    return () => window.removeEventListener('trigger-snapshot-frame', handleCapture);
  }, []);

  useFrame(() => {
    if (pendingCapture.current) {
      pendingCapture.current = false;
      // R3F has just rendered this frame — grab the buffer now
      const image = gl.domElement.toDataURL("image/png");
      onCapture(image);
    }
  });

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
  const [hideHighlights, setHideHighlights] = useState(false);

  // Listen for trigger-snapshot: hide highlights, wait a tick for React render, fire capture, restore
  useEffect(() => {
    const handleTrigger = () => {
      setHideHighlights(true);
      // After React renders with hideHighlights=true (no pink edges),
      // dispatch trigger-snapshot-frame so SnapshotCapture grabs it
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.dispatchEvent(new Event('trigger-snapshot-frame'));
        });
      });
    };
    window.addEventListener('trigger-snapshot', handleTrigger);
    return () => window.removeEventListener('trigger-snapshot', handleTrigger);
  }, []);

  const handleCaptured = useCallback((image) => {
    setHideHighlights(false);
    window.dispatchEvent(new CustomEvent('snapshot-ready', { detail: image }));
  }, []);

  // Clone children and inject hideHighlights prop
  const childrenWithProp = typeof children === 'object'
    ? React.Children.map(children, child =>
        child ? React.cloneElement(child, { hideHighlights }) : child
      )
    : children;
  return (
    <div className="w-full h-full">
      <Canvas camera={{ position: [4, 11.5, 7.5], fov: 45 }} shadows={showShadows} gl={{ preserveDrawingBuffer: true, alpha: true }}>
        {/* Helper to capture reliable snapshots without UI */}
        <SnapshotCapture onCapture={handleCaptured} />
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
        {childrenWithProp}

        {/* Floor and Grid */}
        {showGrid && (
          <Grid
            infiniteGrid
            fadeDistance={40}
            sectionThickness={1.2}
            cellThickness={0.8}
            sectionColor={theme === 'dark' ? "#24555c" : "#8fc3c2"}
            cellColor={theme === 'dark' ? "#173c42" : "#c3dedd"}
            position={[0, -0.02, 0]}
          />
        )}

        {showShadows && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
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
