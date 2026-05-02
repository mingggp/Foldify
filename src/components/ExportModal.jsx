import React, { useState, useRef, useEffect } from 'react';
import { Download, X, ZoomIn, ZoomOut, RotateCw, RotateCcw, Move, Crop, Copy } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function ExportModal({ exportImageBlob, onClose }) {
  const toast = useToast();
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
    link.download = `3d-box-${aspectRatio.replace(':', 'x')}.png`;
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
          toast('เกิดข้อผิดพลาดในการสร้างรูปภาพ', 'error');
          return;
        }
        
        // Use the Clipboard API
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          toast('📋 คัดลอกรูปลงคลิปบอร์ดแล้ว!', 'success');
          onClose();
        } catch (err) {
          console.error('Clipboard write error:', err);
          toast('เบราว์เซอร์ไม่รองรับ หรือยังไม่ได้อนุญาตให้เข้าถึงคลิปบอร์ด', 'error');
        }
      }, 'image/png');
    } catch (err) {
      console.error(err);
      toast('เกิดข้อผิดพลาดในการคัดลอก', 'error');
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

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-900">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Move className="text-indigo-400" size={20} />
            Advanced Export Studio
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Studio Canvas Area */}
        <div 
          ref={containerRef}
          className="flex-1 relative overflow-hidden bg-slate-950 flex items-center justify-center checkered-bg"
        >
          {/* Draggable Image Layer */}
          <div 
            className="w-full h-full absolute inset-0 cursor-grab active:cursor-grabbing flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <img 
              src={src} 
              alt="Snapshot" 
              draggable={false}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out'
              }}
              className="max-w-full max-h-full object-contain pointer-events-none opacity-50"
            />
          </div>

          {/* CROP BOX OVERLAY */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 z-0"></div>
            <div 
              id="crop-box"
              className="relative z-10 border-4 border-indigo-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] overflow-hidden flex items-center justify-center ring-2 ring-white/50"
              style={getCropOverlayStyle()}
            >
               {/* We replicate the image inside the crop box to show it fully opaque! */}
               <img 
                    src={src} 
                    alt="Focus" 
                    draggable={false}
                    className="absolute object-none max-w-none pointer-events-none"
                    style={{
                      transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
                    }}
                  />
                  
                  {/* Grid Lines Overlay */}
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 opacity-20 border border-indigo-400/50">
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-white"></div>
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-r border-white"></div>
                    <div className="border-b border-white"></div>
                    <div className="border-r border-white"></div>
                    <div className="border-r border-white"></div>
                    <div></div>
                  </div>
                </div>
             </div>
          </div>

        {/* Toolbar Footer */}
        <div className="p-5 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-6">
          
          <div className="flex gap-4 items-center">
            {/* Aspect Ratio Selector */}
            <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-lg border border-slate-700">
              <Crop size={16} className="text-slate-500 ml-2" />
              <select 
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="bg-transparent text-sm text-slate-300 font-medium py-1 px-2 focus:outline-none cursor-pointer"
              >
                <option value="original">Original</option>
                <option value="1:1">1:1 Square</option>
                <option value="16:9">16:9 Widescreen</option>
                <option value="4:3">4:3 Standard</option>
              </select>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-3 bg-slate-800 p-1.5 rounded-lg border border-slate-700">
              <button onClick={() => setZoom(Math.max(0.1, zoom - 0.1))} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                <ZoomOut size={18} />
              </button>
              <span className="text-sm font-mono text-slate-300 w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(Math.min(5, zoom + 0.1))} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                <ZoomIn size={18} />
              </button>
            </div>

            {/* Rotate Controls */}
            <div className="flex items-center gap-3 bg-slate-800 p-1.5 rounded-lg border border-slate-700">
              <button onClick={() => setRotation(r => r - 15)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                <RotateCcw size={18} />
              </button>
              <span className="text-sm font-mono text-slate-300 w-12 text-center">{rotation}°</span>
              <button onClick={() => setRotation(r => r + 15)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors">
                <RotateCw size={18} />
              </button>
              <button onClick={() => { setZoom(1); setRotation(0); setPan({x:0, y:0}); }} className="px-3 text-xs text-indigo-400 font-medium hover:text-indigo-300 border-l border-slate-700 ml-1">
                Reset
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={handleCopy}
              className="flex items-center gap-2 px-5 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg shadow transition-colors"
            >
              <Copy size={18} />
              คัดลอกรูป
            </button>
            <button 
              onClick={handleDownload}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-lg hover:shadow-indigo-500/25 transition-all"
            >
              <Download size={18} />
              บันทึกรูป
            </button>
          </div>
        </div>
        
      </div>
      
      {/* Required for the checkered background pattern so transparent snaps look authentic */}
      <style>{`
        .checkered-bg {
          background-image: 
            linear-gradient(45deg, #0f172a 25%, transparent 25%), 
            linear-gradient(-45deg, #0f172a 25%, transparent 25%), 
            linear-gradient(45deg, transparent 75%, #0f172a 75%), 
            linear-gradient(-45deg, transparent 75%, #0f172a 75%);
          background-size: 20px 20px;
          background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
        }
      `}</style>
    </div>
  );
}
