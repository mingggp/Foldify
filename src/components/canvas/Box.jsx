import { useState, useEffect, useMemo } from "react";
import * as THREE from "three";
import { Edges } from "@react-three/drei";
import { VALID_CUBE_NETS } from "./netsConfig";
import { hingeFor, mapEdge, normalizeTransform, resolveFaceIds, rootPlacement } from "../../lib/netGeometry";

// Paint one face (colour, picture, stickers, selection outline) into its canvas texture.
function paintFace(faceCanvas, texture, { color, imgObj, shapes, rotation, flipX, flipY, isSelected }) {
  const ctx = faceCanvas.getContext('2d');
  
  ctx.clearRect(0, 0, 1024, 1024);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1024, 1024);

  if (imgObj) {
    ctx.drawImage(imgObj, 0, 0, 1024, 1024);
  }

  if (shapes && shapes.length > 0) {
    shapes.forEach(shape => {
      ctx.save();
      ctx.translate(shape.x, shape.y);
      ctx.rotate(shape.rotation * (Math.PI / 180));
      ctx.scale(shape.scale, shape.scale);
      
      ctx.fillStyle = shape.color;
      ctx.beginPath();
      
      if (shape.type === 'square') {
        ctx.rect(-50, -50, 100, 100);
      } else if (shape.type === 'circle') {
        ctx.arc(0, 0, 50, 0, Math.PI * 2);
      } else if (shape.type === 'star') {
        for (let i = 0; i < 5; i++) {
          ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * 50, -Math.sin((18 + i * 72) * Math.PI / 180) * 50);
          ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * 20, -Math.sin((54 + i * 72) * Math.PI / 180) * 20);
        }
        ctx.closePath();
      }
      
      ctx.fill();
      ctx.restore();
    });
  }

  if (isSelected) {
    ctx.lineWidth = 40; // Super thick visible border
    ctx.strokeStyle = '#ffb238'; // spark (selected face)
    ctx.strokeRect(20, 20, 984, 984); // Inset slightly so thick lines stay inside UV
  }

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
    paintFace(faceCanvas, texture, { color, imgObj, shapes, rotation: config.rotation, flipX: config.flipX, flipY: config.flipY, isSelected });
  }, [color, imgObj, shapes, config.rotation, config.flipX, config.flipY, isSelected, faceCanvas, texture]);

  const Material = showShadows ? "meshStandardMaterial" : "meshBasicMaterial";

  // Use a noticeable emissive color for selected (e.g. Vivid Pink glow), and subtle for hovered
  const emissiveColor = isSelected ? "#3d2600" : isHovered ? "#0d3330" : "#000000";
  // For unlit mode (BasicMaterial), we change the base color tint directly
  const basicColor = isSelected ? "#ffe6b8" : isHovered ? "#d9f6f2" : "#ffffff";

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

  // Only show edges when NOT capturing a snapshot
  const drawEdges = !hideHighlights && (isSelected || isHovered) && (
    <Edges
      name="highlight-edge"
      scale={isSelected ? 1.02 : 1.01}
      color={isSelected ? "#ffb238" : "#00c8b5"}
      threshold={15}
    />
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
