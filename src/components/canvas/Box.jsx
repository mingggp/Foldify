import { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { Edges, Text } from "@react-three/drei";
import { VALID_CUBE_NETS } from "./netsConfig";

// FaceMaterial handles drawing base colors, textures, and vector shapes to a CanvasTexture.
function FaceMaterial({ config, showShadows, isHovered, isSelected }) {
  const { color, textureUrl, shapes } = config;
  const canvasRef = useRef(null);
  
  if (!canvasRef.current) {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    canvasRef.current = canvas;
  }
  
  const [texture] = useState(() => {
    const tex = new THREE.CanvasTexture(canvasRef.current);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
  const [imgObj, setImgObj] = useState(null);

  useEffect(() => {
    if (!textureUrl) {
      setImgObj(null);
      return;
    }
    const img = new Image();
    img.src = textureUrl;
    img.crossOrigin = "Anonymous";
    img.onload = () => setImgObj(img);
  }, [textureUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
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
      ctx.strokeStyle = '#ec4899'; // Vivid Pink (Pink 500)
      ctx.strokeRect(20, 20, 984, 984); // Inset slightly so thick lines stay inside UV
    }

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.center.set(0.5, 0.5);
    texture.rotation = -config.rotation * (Math.PI / 180);
    
    const repeatX = config.flipX ? -1 : 1;
    const repeatY = config.flipY ? -1 : 1;
    texture.wrapS = config.flipX ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.wrapT = config.flipY ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    texture.repeat.set(repeatX, repeatY);
    
    texture.needsUpdate = true;
  }, [color, imgObj, shapes, config.rotation, config.flipX, config.flipY, texture, isSelected]);

  const Material = showShadows ? "meshStandardMaterial" : "meshBasicMaterial";
  
  // Use a noticeable emissive color for selected (e.g. Vivid Pink glow), and subtle for hovered
  const emissiveColor = isSelected ? "#831843" : isHovered ? "#333333" : "#000000";
  // For unlit mode (BasicMaterial), we change the base color tint directly
  const basicColor = isSelected ? "#fbcfe8" : isHovered ? "#e2e8f0" : "#ffffff";
  
  const hoverProps = showShadows ? { emissive: emissiveColor } : { color: basicColor };

  return (
    <Material 
      color="#ffffff" 
      map={texture} 
      side={THREE.DoubleSide} 
      roughness={0.3} 
      {...hoverProps}
    />
  );
}

// Recursive algorithm for processing arbitrary folding nets!
function FaceNode({ node, angle, facesConfig, getBinds, showShadows, showLabels, selectedFace, hoveredFace, netFlipX, netFlipY, hideHighlights }) {
  // Determine folding mappings strictly relative to parent's MESH CENTER
  const getMappings = (edge) => {
    let logicalEdge = edge;
    // Intercept physical tree directions using absolute flips!
    if (netFlipX) {
      if (logicalEdge === 'left') logicalEdge = 'right';
      else if (logicalEdge === 'right') logicalEdge = 'left';
    }
    if (netFlipY) {
      if (logicalEdge === 'top') logicalEdge = 'bottom';
      else if (logicalEdge === 'bottom') logicalEdge = 'top';
    }

    switch (logicalEdge) {
      case 'bottom': return { hingePos: [0, -1, 0], meshPos: [0, -1, 0], rot: [-angle, 0, 0] };
      case 'top':    return { hingePos: [0, 1, 0],  meshPos: [0, 1, 0],  rot: [angle, 0, 0] };
      case 'left':   return { hingePos: [-1, 0, 0], meshPos: [-1, 0, 0], rot: [0, angle, 0] };
      case 'right':  return { hingePos: [1, 0, 0],  meshPos: [1, 0, 0],  rot: [0, -angle, 0] };
      default:       return { hingePos: [0, 0, 0],  meshPos: [0, 0, 0],  rot: [0, 0, 0] }; // Root handles itself
    }
  };

  const map = getMappings(node.edge);

  const isSelected = selectedFace === node.id;
  const isHovered = hoveredFace === node.id;

  // Only show edges when NOT capturing a snapshot
  const drawEdges = !hideHighlights && (isSelected || isHovered) && (
    <Edges 
      name="highlight-edge"
      scale={isSelected ? 1.02 : 1.01} 
      color={isSelected ? "#ec4899" : "#a5b4fc"} 
      threshold={15} 
    />
  );

  return (
    // 1. Move to Hinge, apply localized folding geometry rotation
    <group position={map.hingePos} rotation={map.rot}>
      
      {/* 2. Position the PlaneMesh radiating securely from the Hinge */}
      <mesh position={map.meshPos} receiveShadow={showShadows} castShadow={showShadows} userData={{ faceId: node.id }} {...getBinds(node.id)}>
        <planeGeometry args={[2, 2]} />
        <FaceMaterial config={facesConfig[node.id]} showShadows={showShadows} isHovered={isHovered} isSelected={isSelected} />
        {drawEdges}
        
        {/* Render Label floating slightly above face if enabled */}
        {showLabels && (
          <Text 
            position={[0, 0, -0.05]} 
            rotation={[0, Math.PI, 0]}
            fontSize={0.4} 
            color="#ffffff" 
            outlineWidth={0.03} 
            outlineColor="#000000"
            anchorX="center" 
            anchorY="middle"
          >
            {(node.id === 'left' ? 'RIGHT' : node.id === 'right' ? 'LEFT' : node.id.toUpperCase())}
          </Text>
        )}
      </mesh>
      
      {/* 3. Recursively stack children!
             But we must translate coordinate system to precisely the center of THIS Plane mesh
             so children calculate their hinges properly. */}
      {node.children && node.children.length > 0 && (
        <group position={map.meshPos}>
          {node.children.map(childNode => (
             <FaceNode 
               key={childNode.id} 
               node={childNode} 
               angle={angle} 
               facesConfig={facesConfig} 
               getBinds={getBinds} 
               showShadows={showShadows}
               showLabels={showLabels}
               selectedFace={selectedFace}
               hoveredFace={hoveredFace}
               netFlipX={netFlipX}
               netFlipY={netFlipY}
               hideHighlights={hideHighlights}
             />
          ))}
        </group>
      )}
    </group>
  );
}

export default function Box({ foldProgress = 1, facesConfig, selectedFace, setSelectedFace, showShadows, showLabels, activeNetId = 0, netFlipX = false, netFlipY = false, hideHighlights = false }) {
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

  const angle = foldProgress * (Math.PI / 2);
  const liftHeight = 2 * Math.sin(angle);
  
  // Guard the array in case an invalid index arises during hot reloading
  const activeNetLayout = VALID_CUBE_NETS[activeNetId] || VALID_CUBE_NETS[0];

  return (
    <group 
      position={[0, liftHeight, 0]} 
      rotation={[Math.PI / 2, 0, 0]}
    >
       <FaceNode 
         node={activeNetLayout} 
         angle={angle}
         facesConfig={facesConfig}
         getBinds={getBinds}
         showShadows={showShadows}
         showLabels={showLabels}
         selectedFace={selectedFace}
         hoveredFace={hoveredFace}
         netFlipX={netFlipX}
         netFlipY={netFlipY}
         hideHighlights={hideHighlights}
       />
    </group>
  );
}
