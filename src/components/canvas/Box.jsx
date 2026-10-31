import { useState, useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { VALID_CUBE_NETS } from "./netsConfig";
import { drawShapes } from "../../lib/shapes";
import { hingeFor, mapEdge, normalizeTransform, resolveFaceIds, rootPlacement } from "../../lib/netGeometry";

// Paint one face (colour, picture, shapes) into its canvas texture. Selection is NOT painted
// here (that meant re-uploading a 1024px texture on every click); see SelectionGlow.
function paintFace(faceCanvas, texture, { color, imgObj, shapes, rotation, flipX, flipY }) {
  const ctx = faceCanvas.getContext('2d');
  
  ctx.clearRect(0, 0, 1024, 1024);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1024, 1024);

  if (imgObj) {
    ctx.drawImage(imgObj, 0, 0, 1024, 1024);
  }

  drawShapes(ctx, shapes);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.center.set(0.5, 0.5);
  texture.rotation = -rotation * (Math.PI / 180);
  
  const repeatX = flipX ? -1 : 1;
  const repeatY = flipY ? -1 : 1;
  texture.wrapS = flipX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = flipY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.repeat.set(repeatX, repeatY);
  
  texture.needsUpdate = true;
}

const imageCache = new Map(); // url -> decoded HTMLImageElement
function rememberImage(url, img) {
  imageCache.set(url, img);
  if (imageCache.size > 48) imageCache.delete(imageCache.keys().next().value);
}

// FaceMaterial handles drawing base colors, textures, and vector shapes to a CanvasTexture.
function FaceMaterial({ config, showShadows, isHovered, isSelected }) {
  const { color, textureUrl, shapes } = config;
  // One canvas + texture per face, created once and redrawn in place.
  const { canvas: faceCanvas, texture } = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, texture: tex };
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  // Remember which URL the loaded image belongs to, so a slow old image can never
  // overwrite a newer one. Decoded images are cached by URL so switching nets
  // (which moves pictures between squares) never flashes a blank face.
  const [loaded, setLoaded] = useState({ url: null, img: null });
  const imgObj = !textureUrl
    ? null
    : imageCache.get(textureUrl) || (loaded.url === textureUrl ? loaded.img : null);

  useEffect(() => {
    if (!textureUrl || imageCache.has(textureUrl)) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      rememberImage(textureUrl, img);
      if (!cancelled) setLoaded({ url: textureUrl, img });
    };
    img.src = textureUrl;
    return () => { cancelled = true; };
  }, [textureUrl]);

  useEffect(() => {
    paintFace(faceCanvas, texture, { color, imgObj, shapes, rotation: config.rotation, flipX: config.flipX, flipY: config.flipY });
  }, [color, imgObj, shapes, config.rotation, config.flipX, config.flipY, faceCanvas, texture]);

  const Material = showShadows ? "meshStandardMaterial" : "meshBasicMaterial";

  // Use a noticeable emissive color for selected (e.g. Vivid Pink glow), and subtle for hovered
  const emissiveColor = isHovered && !isSelected ? "#0d3330" : "#000000";
  // For unlit mode (BasicMaterial), we change the base color tint directly
  const basicColor = isHovered && !isSelected ? "#d9f6f2" : "#ffffff";

  const hoverProps = showShadows ? { emissive: emissiveColor } : { color: basicColor };

  // FrontSide only: the printed side is the plane's front (+Z), which always faces
  // OUT of the box. Rendering the back with the same texture is what produced the
  // mirror-image letters (R -> Я). The back is drawn separately as the plain inside.
  return (
    <Material
      color="#ffffff"
      map={texture}
      side={THREE.FrontSide}
      shadowSide={THREE.DoubleSide}
      roughness={0.3}
      {...hoverProps}
    />
  );
}

// Selected face: a slowly travelling teal→amber gradient around the border plus a soft
// breathing glow, drawn by a tiny shader on top of the face (no texture repaint).
const glowVertex = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const glowFragment = `
  uniform float uTime;
  varying vec2 vUv;
  vec3 ramp(float t) {
    vec3 a = vec3(0.0, 0.835, 0.788);   // #00d5c9
    vec3 b = vec3(0.157, 0.631, 0.671); // #28a1ab
    vec3 c = vec3(1.0, 0.698, 0.22);    // #ffb238
    t = fract(t) * 3.0;
    if (t < 1.0) return mix(a, b, smoothstep(0.0, 1.0, t));
    if (t < 2.0) return mix(b, c, smoothstep(1.0, 2.0, t));
    return mix(c, a, smoothstep(2.0, 3.0, t));
  }
  void main() {
    float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float ang = atan(vUv.y - 0.5, vUv.x - 0.5) / 6.2831853 + 0.5;
    vec3 col = ramp(ang - uTime * 0.12);
    float border = 1.0 - smoothstep(0.045, 0.06, e);
    float glow = (1.0 - smoothstep(0.0, 0.3, e)) * (0.22 + 0.12 * sin(uTime * 2.2));
    gl_FragColor = vec4(col, max(border, glow));
  }
`;
function SelectionGlow() {
  const ref = useRef(null);
  useFrame((state) => {
    if (ref.current) ref.current.uniforms.uTime.value = state.clock.elapsedTime;
  });
  return (
    <mesh name="selection-glow" position={[0, 0, 0.004]} raycast={noRaycast} renderOrder={3}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={ref}
        args={[{ uniforms: { uTime: { value: 0 } }, vertexShader: glowVertex, fragmentShader: glowFragment }]}
        transparent
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
        toneMapped={false}
      />
    </mesh>
  );
}

// Plain "inside of the paper" material, so students can tell inside from outside.
function InsideMaterial({ showShadows }) {
  const Material = showShadows ? "meshStandardMaterial" : "meshBasicMaterial";
  return <Material color={INSIDE_COLOR} side={THREE.BackSide} roughness={0.9} />;
}

const INSIDE_COLOR = "#d6dde6";
const noRaycast = () => null;

// Face label drawn on our own canvas (drei <Text> downloads fonts from a CDN,
// which suspends the whole scene when offline).
function FaceLabel({ text }) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.font = "bold 120px system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 18;
    ctx.strokeStyle = "rgba(15, 23, 42, 0.85)";
    ctx.strokeText(text, 256, 132);
    ctx.fillStyle = "#ffffff";
    ctx.fillText(text, 256, 132);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, 0, 0.01]} raycast={noRaycast} renderOrder={2}>
      <planeGeometry args={[1.4, 0.7]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} side={THREE.FrontSide} toneMapped={false} />
    </mesh>
  );
}

// Recursive renderer: each face hangs off its parent's edge on a hinge.
// `edge` is the PHYSICAL edge of the parent (after net rotation / mirror),
// so the flat layout on screen is exactly the layout on paper.
function FaceNode({ node, path, edge, angle, transform, faceIds, facesConfig, getBinds, showShadows, showLabels, selectedFace, hoveredFace, hideHighlights }) {
  const faceId = faceIds.get(path);
  const hinge = hingeFor(edge, angle);

  const isSelected = selectedFace === faceId;
  const isHovered = hoveredFace === faceId;

  // Hover outline (not while capturing a snapshot); the selected face gets SelectionGlow.
  const drawEdges = !hideHighlights && isHovered && !isSelected && (
    <Edges name="highlight-edge" scale={1.01} color="#00c8b5" threshold={15} />
  );

  const userData = { faceId, path };

  return (
    // 1. Move to the hinge on the parent's edge and fold around it
    <group position={hinge.offset} rotation={hinge.rot}>
      {/* 2. Printed (outside) side */}
      <mesh name={`face-${faceId}`} position={hinge.offset} receiveShadow={showShadows} castShadow={showShadows} userData={{ ...userData, role: "print" }} {...getBinds(faceId)}>
        <planeGeometry args={[2, 2]} />
        <FaceMaterial config={facesConfig[faceId]} showShadows={showShadows} isHovered={isHovered} isSelected={isSelected} />
        {drawEdges}
        {isSelected && !hideHighlights && <SelectionGlow />}
        {showLabels && <FaceLabel text={faceId.toUpperCase()} />}
      </mesh>
      {/* 3. Inside of the paper */}
      <mesh name={`inside-${faceId}`} position={hinge.offset} receiveShadow={showShadows} userData={{ ...userData, role: "inside" }} {...getBinds(faceId)}>
        <planeGeometry args={[2, 2]} />
        <InsideMaterial showShadows={showShadows} />
      </mesh>

      {/* 4. Children hinge off THIS face, so move to its centre first */}
      {node.children && node.children.length > 0 && (
        <group position={hinge.offset}>
          {node.children.map((childNode, i) => (
            <FaceNode
              key={`${path}.${i}`}
              node={childNode}
              path={`${path}.${i}`}
              edge={mapEdge(childNode.edge, transform)}
              angle={angle}
              transform={transform}
              faceIds={faceIds}
              facesConfig={facesConfig}
              getBinds={getBinds}
              showShadows={showShadows}
              showLabels={showLabels}
              selectedFace={selectedFace}
              hoveredFace={hoveredFace}
              hideHighlights={hideHighlights}
            />
          ))}
        </group>
      )}
    </group>
  );
}

export default function Box({ foldProgress = 1, facesConfig, selectedFace, setSelectedFace, showShadows, showLabels, activeNetId = 0, netFlipX = false, netFlipY = false, netRotation = 0, hideHighlights = false }) {
  const [hoveredFace, setHoveredFace] = useState(null);

  const getBinds = (faceId) => ({
    onClick: (e) => {
      e.stopPropagation();
      setSelectedFace(faceId);
    },
    onPointerOver: (e) => {
      e.stopPropagation();
      setHoveredFace(faceId);
      document.body.style.cursor = 'pointer';
    },
    onPointerOut: (e) => {
      e.stopPropagation();
      setHoveredFace(null);
      document.body.style.cursor = 'auto';
    }
  });

  // Guard the array in case an invalid index arises during hot reloading
  const activeNetLayout = VALID_CUBE_NETS[activeNetId] || VALID_CUBE_NETS[0];
  const transform = useMemo(
    () => normalizeTransform({ rotation: netRotation, flipX: netFlipX, flipY: netFlipY }),
    [netRotation, netFlipX, netFlipY]
  );
  const faceIds = useMemo(() => resolveFaceIds(activeNetLayout, transform), [activeNetLayout, transform]);
  const { angle, position, rotation } = rootPlacement(foldProgress);

  return (
    <group name="foldify-net" position={position} rotation={rotation}>
      <FaceNode
        node={activeNetLayout}
        path="0"
        edge={null}
        angle={angle}
        transform={transform}
        faceIds={faceIds}
        facesConfig={facesConfig}
        getBinds={getBinds}
        showShadows={showShadows}
        showLabels={showLabels}
        selectedFace={selectedFace}
        hoveredFace={hoveredFace}
        hideHighlights={hideHighlights}
      />
    </group>
  );
}
