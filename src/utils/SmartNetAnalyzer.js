import { VALID_CUBE_NETS } from "../components/canvas/netsConfig";

// Generate 2D signatures for the 11 valid nets automatically
function generateNetSignatures() {
  const signatures = [];

  VALID_CUBE_NETS.forEach((net, index) => {
    // Generate base points
    const points = [];
    const traverse = (node, x, y) => {
      points.push({ id: node.id, x, y });
      if (node.children) {
        node.children.forEach(child => {
          let nx = x, ny = y;
          if (child.edge === 'top') ny -= 1;
          else if (child.edge === 'bottom') ny += 1;
          else if (child.edge === 'left') nx -= 1;
          else if (child.edge === 'right') nx += 1;
          traverse(child, nx, ny);
        });
      }
    };
    traverse(net, 0, 0);

    // Normalize
    const minX = Math.min(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    points.forEach(p => { p.x -= minX; p.y -= minY; });

    const width = Math.max(...points.map(p => p.x)) + 1;
    const height = Math.max(...points.map(p => p.y)) + 1;

    // Generate 8 transformations (4 rotations x 2 flips)
    const transforms = [];

    // We'll keep it simple: generate flipX, flipY, and transposed (swap x/y).
    // This covers all 8 combinations.
    for (let flipX of [false, true]) {
      for (let flipY of [false, true]) {
        for (let swapXY of [false, true]) {
          const tPoints = points.map(p => {
            let px = flipX ? (width - 1 - p.x) : p.x;
            let py = flipY ? (height - 1 - p.y) : p.y;
            return swapXY ? { id: p.id, x: py, y: px } : { id: p.id, x: px, y: py };
          });

          const tW = swapXY ? height : width;
          const tH = swapXY ? width : height;

          // Build string signature e.g., "1100,0110..."
          let sig = "";
          for (let y = 0; y < tH; y++) {
            for (let x = 0; x < tW; x++) {
              sig += tPoints.some(p => p.x === x && p.y === y) ? "1" : "0";
            }
            sig += ",";
          }
          sig = sig.slice(0, -1);

          // Check if already added
          if (!transforms.find(t => t.sig === sig)) {
            transforms.push({ sig, points: tPoints, columns: tW, rows: tH, flipX, flipY, swapXY });
          }
        }
      }
    }

    signatures.push({ index, transforms });
  });

  return signatures;
}

const NET_SIGNATURES = generateNetSignatures();

export async function analyzeNetImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const MAX_DIM = 800;
      let scale = 1;
      if (img.width > MAX_DIM || img.height > MAX_DIM) {
        scale = MAX_DIM / Math.max(img.width, img.height);
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 1. Convert to Grayscale & Calculate Average Brightness
      const gray = new Uint8Array(canvas.width * canvas.height);
      let totalLuma = 0;
      for (let i = 0; i < canvas.width * canvas.height; i++) {
        const idx = i * 4;
        // Luminance formula
        const luma = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
        gray[i] = luma;
        totalLuma += luma;
      }
      const avgLuma = totalLuma / (canvas.width * canvas.height);

      const mask = new Int8Array(canvas.width * canvas.height); // 0=bg, 1=line, -1=outside
      const w = canvas.width;
      const h = canvas.height;

      // 2. Thresholding: pixels significantly darker than average are lines.
      // In a photo of paper, paper is bright, lines are dark.
      const threshold = avgLuma * 0.8; // anything darker than 80% of average is a line
      for (let i = 0; i < canvas.width * canvas.height; i++) {
        if (data[i * 4 + 3] > 50 && gray[i] < threshold) {
          mask[i] = 1; // foreground / line
        }
      }

      // 3. Heavy Dilation to merge all dashed lines and shapes into one giant blob
      const dilateRadius = Math.max(2, Math.floor(Math.min(w, h) * 0.02)); // ~16px for 800px image
      const dilated = new Int8Array(w * h);

      // Fast approximate dilation: block max filter
      // Pass 1: Horizontal
      const temp = new Int8Array(w * h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let maxVal = 0;
          for (let dx = -dilateRadius; dx <= dilateRadius; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < w && mask[y * w + nx] === 1) {
              maxVal = 1;
              break;
            }
          }
          temp[y * w + x] = maxVal;
        }
      }
      // Pass 2: Vertical
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let maxVal = 0;
          for (let dy = -dilateRadius; dy <= dilateRadius; dy++) {
            const ny = y + dy;
            if (ny >= 0 && ny < h && temp[ny * w + x] === 1) {
              maxVal = 1;
              break;
            }
          }
          dilated[y * w + x] = maxVal;
        }
      }

      // 4. Find Connected Components on Dilated Mask
      const labels = new Int32Array(w * h);
      const sizes = [];
      const bboxes = [];
      let currentLabel = 1;
      const q = [];

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          if (dilated[i] === 1 && labels[i] === 0) {
            let size = 0;
            let cMinX = x, cMinY = y, cMaxX = x, cMaxY = y;
            q.push(x, y);
            labels[i] = currentLabel;
            let qIter = 0;

            while (qIter < q.length) {
              const cx = q[qIter++];
              const cy = q[qIter++];
              size++;

              if (cx < cMinX) cMinX = cx;
              if (cx > cMaxX) cMaxX = cx;
              if (cy < cMinY) cMinY = cy;
              if (cy > cMaxY) cMaxY = cy;

              // 4-way connectivity is enough for dilated blobs
              const neighbors = [[0, 1], [1, 0], [0, -1], [-1, 0]];
              for (const [dx, dy] of neighbors) {
                const nx = cx + dx, ny = cy + dy;
                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                  const ni = ny * w + nx;
                  if (dilated[ni] === 1 && labels[ni] === 0) {
                    labels[ni] = currentLabel;
                    q.push(nx, ny);
                  }
                }
              }
            }
            sizes[currentLabel] = size;
            bboxes[currentLabel] = { minX: cMinX, minY: cMinY, maxX: cMaxX, maxY: cMaxY };
            currentLabel++;
            q.length = 0;
          }
        }
      }

      // Find the LARGEST blob (this will be the cube net)
      let maxLabel = 0;
      let maxSize = 0;
      for (let i = 1; i < currentLabel; i++) {
        if (sizes[i] > maxSize) {
          maxSize = sizes[i];
          maxLabel = i;
        }
      }

      if (maxLabel === 0) {
        return reject(new Error("ไม่พบรูปทรงในภาพ (No shape detected)."));
      }

      // The bounding box of the largest blob, shrunk by dilateRadius
      let minX = Math.max(0, bboxes[maxLabel].minX + dilateRadius);
      let minY = Math.max(0, bboxes[maxLabel].minY + dilateRadius);
      let maxX = Math.min(w - 1, bboxes[maxLabel].maxX - dilateRadius);
      let maxY = Math.min(h - 1, bboxes[maxLabel].maxY - dilateRadius);

      const bboxWidth = maxX - minX + 1;
      const bboxHeight = maxY - minY + 1;

      // 5. Flood fill from borders on the DILATED mask to reliably mark the OUTSIDE as -1
      // This is crucial because heavy dilation seals all gaps (like dashed lines)
      const qFill = [];
      const addQueue = (x, y) => {
        if (x >= 0 && x < w && y >= 0 && y < h) {
          const i = y * w + x;
          if (dilated[i] === 0) {
            dilated[i] = -1; // Mark as outside
            qFill.push(x, y);
          }
        }
      };

      for (let x = 0; x < w; x++) { addQueue(x, 0); addQueue(x, h - 1); }
      for (let y = 0; y < h; y++) { addQueue(0, y); addQueue(w - 1, y); }

      let qIterFill = 0;
      while (qIterFill < qFill.length) {
        const x = qFill[qIterFill++];
        const y = qFill[qIterFill++];
        addQueue(x + 1, y); addQueue(x - 1, y);
        addQueue(x, y + 1); addQueue(x, y - 1);
      }

      // 6. Grid Estimation
      let bestCols = 1, bestRows = 1;
      let minDiff = Infinity;
      for (let c = 1; c <= 5; c++) {
        for (let r = 1; r <= 5; r++) {
          if (c * r < 6) continue;
          const cellW = bboxWidth / c;
          const cellH = bboxHeight / r;
          const diff = Math.abs(cellW - cellH);
          if (diff < minDiff) {
            minDiff = diff;
            bestCols = c;
            bestRows = r;
          }
        }
      }

      const cellW = bboxWidth / bestCols;
      const cellH = bboxHeight / bestRows;

      // 6. Generate Signature
      let detectedSig = "";
      let filledCellsCount = 0;

      for (let r = 0; r < bestRows; r++) {
        for (let c = 0; c < bestCols; c++) {
          let insideCount = 0;
          let totalCount = 0;

          const startX = Math.floor(minX + c * cellW);
          const startY = Math.floor(minY + r * cellH);
          const endX = Math.floor(startX + cellW);
          const endY = Math.floor(startY + cellH);

          // Sub-sample cell with a margin to avoid border overlaps
          const marginX = Math.floor(cellW * 0.2);
          const marginY = Math.floor(cellH * 0.2);

          for (let y = startY + marginY; y < endY - marginY; y++) {
            for (let x = startX + marginX; x < endX - marginX; x++) {
              if (y >= 0 && y < canvas.height && x >= 0 && x < canvas.width) {
                if (dilated[y * canvas.width + x] !== -1) {
                  insideCount++;
                }
                totalCount++;
              }
            }
          }

          if (totalCount > 0 && (insideCount / totalCount) > 0.4) {
            detectedSig += "1";
            filledCellsCount++;
          } else {
            detectedSig += "0";
          }
        }
        detectedSig += ",";
      }
      detectedSig = detectedSig.slice(0, -1);

      if (filledCellsCount !== 6) {
        return reject(new Error(`เราตรวจพบกล่องสี่เหลี่ยมจำนวน ${filledCellsCount} ชิ้น (ต้องมี 6 ชิ้นพอดีจึงจะเป็นรูปคลี่ลูกบาศก์ที่สมบูรณ์) แนะนำให้ใช้รูปพื้นหลังสว่างๆ ที่เห็นเส้นชัดเจนครับ`));
      }

      // Match against known signatures
      let matchedNetIndex = -1;
      let matchedTransform = null;

      for (const net of NET_SIGNATURES) {
        for (const transform of net.transforms) {
          if (transform.sig === detectedSig) {
            matchedNetIndex = net.index;
            matchedTransform = transform;
            break;
          }
        }
        if (matchedNetIndex !== -1) break;
      }

      if (matchedNetIndex === -1) {
        return reject(new Error("Net pattern recognized, but it is not one of the 11 valid folding cube hexominoes."));
      }

      // We found a match! Slice the textures for each of the 6 faces!
      const extractedFaces = {};

      matchedTransform.points.forEach(point => {
        const sx = minX + point.x * cellW;
        const sy = minY + point.y * cellH;

        const faceCanvas = document.createElement("canvas");
        const size = Math.max(cellW, cellH);
        faceCanvas.width = 512;
        faceCanvas.height = 512;
        const fCtx = faceCanvas.getContext("2d");

        fCtx.imageSmoothingEnabled = true;
        fCtx.imageSmoothingQuality = 'high';

        fCtx.fillStyle = '#ffffff';
        fCtx.fillRect(0, 0, 512, 512);

        fCtx.save();
        if (matchedTransform.swapXY) {
          fCtx.translate(256, 256);
          fCtx.transform(0, 1, 1, 0, 0, 0); // Transpose the canvas
          fCtx.translate(-256, -256);
        }

        fCtx.drawImage(
          canvas,
          sx, sy, cellW, cellH,
          0, 0, 512, 512
        );
        fCtx.restore();

        extractedFaces[point.id] = faceCanvas.toDataURL("image/png");
      });

      resolve({
        activeNetId: matchedNetIndex,
        extractedFaces, // { front: dataUrl, top: dataUrl, ... }
        // We will assume logical coordinates are just mapped, we don't need to change netFlipX/Y 
        // since our mapping algorithm directly matched the absolute positions! Wait, if the user rotates the 3D model, 
        // flipping might be needed for the 3D mesh structure to match visually, but mapping 
        // the faces to the semantic logical IDs guarantees the textures go to the right places.
        // However, if the net form is flipped horizontally from base, activeNetId doesn't track flips.
        // The 3D engine uses netFlipX/Y. We should pass them.
        netFlipX: matchedTransform.flipX,
        netFlipY: matchedTransform.flipY,
        swapXY: matchedTransform.swapXY
      });

    };
    img.onerror = () => reject(new Error("Failed to read image file."));
    img.src = URL.createObjectURL(file);
  });
}
