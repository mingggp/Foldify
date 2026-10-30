import React, { useState, useRef, useEffect } from 'react';
import { Download, ZoomIn, ZoomOut, RotateCw, RotateCcw, ImageDown, Copy } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';
import { useLang } from '../contexts/LanguageContext';
import Modal, { Segmented } from './ui/Modal';

export default function ExportModal({ exportImageBlob, onClose }) {
  const toast = useToast();
  const { t } = useLang();
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const [aspectRatio, setAspectRatio] = useState('original'); // 'original', '1:1', '16:9', '4:3'
  
  const containerRef = useRef(null);
  
  const src = exportImageBlob;
  const [originalRatio, setOriginalRatio] = useState(1);

  useEffect(() => {
    const img = new Image();
    img.src = src;
    img.onload = () => {
      setOriginalRatio(img.width / img.height);
    };
  }, [src]);

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const Ratios = {
    'original': null,
    '1:1': 1,
    '16:9': 16 / 9,
    '4:3': 4 / 3,
  };

  const generateExportCanvas = () => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      const img = new Image();
      img.src = src;
      img.onload = () => {
        let exportW = img.width;
        let exportH = img.height;

        const cropBox = document.getElementById('crop-box');
        if (aspectRatio !== 'original' && cropBox) {
          const cropRect = cropBox.getBoundingClientRect();
          exportW = cropRect.width;
          exportH = cropRect.height;
        }

        canvas.width = exportW;
        canvas.height = exportH;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.translate(pan.x, pan.y);
        ctx.scale(zoom, zoom);
        ctx.rotate(rotation * (Math.PI / 180));
        
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas);
      };
    });
  };

  const handleDownload = async () => {
    const canvas = await generateExportCanvas();
    const finalImage = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.href = finalImage;
    link.download = `foldify-${aspectRatio.replace(':', 'x')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    onClose();
  };

  const handleCopy = async () => {
    try {
      const canvas = await generateExportCanvas();
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast(t('exportFailed'), 'error');
          return;
        }
        
        // Use the Clipboard API
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          toast(t('exportCopied'), 'success');
          onClose();
        } catch (err) {
          console.error('Clipboard write error:', err);
          toast(t('exportClipboardBlocked'), 'error');
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      toast(t('exportFailed'), 'error');
    }
  };

  // Compute CSS style for the crop overlay box
  const getCropOverlayStyle = () => {
    const targetRatio = aspectRatio === 'original' ? originalRatio : Ratios[aspectRatio];
    // We try to maximize the crop box within the preview area visually!
    return {
      aspectRatio: targetRatio,
      width: targetRatio > 1 ? '90%' : 'auto',
      height: targetRatio <= 1 ? '90%' : 'auto',
      maxHeight: '90%',
      maxWidth: '90%',
    };
  };

  const tool = "flex items-center gap-1 p-1 rounded-xl bg-surface-2 border border-line";
  return (
    <Modal
      title={t("exportTitle")}
      subtitle={t("exportHint")}
      icon={ImageDown}
      onClose={onClose}
      size="xl"
      z="z-[200]"
      testId="export"
      footer={
        <>
          <div className="flex flex-wrap gap-2 mr-auto">
            <Segmented
              value={aspectRatio}
              onChange={setAspectRatio}
              label={t("exportRatio")}
              options={[
                { value: "original", label: t("exportOriginal") },
                { value: "1:1", label: "1:1" },
                { value: "4:3", label: "4:3" },
                { value: "16:9", label: "16:9" },
              ]}
            />
            <div className={tool}>
              <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} className="btn btn-ghost btn-icon min-h-8 min-w-8" aria-label={t("zoomOut")}><ZoomOut size={16} /></button>
              <span className="text-xs w-10 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(5, zoom + 0.1))} className="btn btn-ghost btn-icon min-h-8 min-w-8" aria-label={t("zoomIn")}><ZoomIn size={16} /></button>
            </div>
            <div className={tool}>
              <button onClick={() => setRotation((r) => r - 15)} className="btn btn-ghost btn-icon min-h-8 min-w-8" aria-label={t("turnLeft")}><RotateCcw size={16} /></button>
              <span className="text-xs w-10 text-center tabular-nums">{rotation}°</span>
              <button onClick={() => setRotation((r) => r + 15)} className="btn btn-ghost btn-icon min-h-8 min-w-8" aria-label={t("turnRight")}><RotateCw size={16} /></button>
              <button onClick={() => { setZoom(1); setRotation(0); setPan({ x: 0, y: 0 }); }} className="btn btn-ghost min-h-8 text-xs px-2">{t("reset")}</button>
            </div>
          </div>
          <button onClick={handleCopy} className="btn btn-soft h-11"><Copy size={17} />{t("exportCopy")}</button>
          <button onClick={handleDownload} className="btn btn-primary h-11"><Download size={17} />{t("exportSave")}</button>
        </>
      }
    >
      <div
        ref={containerRef}
        className="relative h-[55dvh] rounded-2xl overflow-hidden checkered-bg flex items-center justify-center select-none"
      >
        {/* draggable image */}
        <div
          className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`, transition: isDragging ? "none" : "transform 0.1s ease-out" }}
            className="max-w-full max-h-full object-contain pointer-events-none opacity-40"
          />
        </div>

        {/* crop frame */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div
            id="crop-box"
            className="relative z-10 border-2 border-mint shadow-[0_0_0_9999px_rgb(3_22_26/0.55)] overflow-hidden flex items-center justify-center rounded-md"
            style={getCropOverlayStyle()}
          >
            <img
              src={src}
              alt={t("exportPreview")}
              draggable={false}
              className="absolute object-none max-w-none pointer-events-none"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)` }}
            />
            <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-25">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className={`${i % 3 < 2 ? "border-r" : ""} ${i < 6 ? "border-b" : ""} border-white`} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* checkered background so transparent snapshots look right */}
      <style>{`
        .checkered-bg {
          background-color: var(--surface-2);
          background-image:
            linear-gradient(45deg, var(--line) 25%, transparent 25%),
            linear-gradient(-45deg, var(--line) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, var(--line) 75%),
            linear-gradient(-45deg, transparent 75%, var(--line) 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
      `}</style>
    </Modal>
  );
}
