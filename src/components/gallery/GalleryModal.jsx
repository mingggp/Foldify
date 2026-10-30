import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getUserBoxes, deleteBox, setBoxVisibility } from "../../services/db";
import { X, Loader2, Trash2, Box, Calendar, Share2, Globe } from "lucide-react";
import { QrBlock } from "../share/ShareModal";
import { appBaseUrl, buildShareLink } from "../../lib/shareLink";
import { useLang } from "../../contexts/LanguageContext";
import { useToast } from "../../contexts/ToastContext";

export default function GalleryModal({ isOpen, onClose, onLoadBox }) {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(null); // box being shared
  const [busy, setBusy] = useState(false);
  const { t } = useLang();

  const setVisibility = async (box, visibility) => {
    try {
      setBusy(true);
      await setBoxVisibility(box.id, visibility);
      const updated = { ...box, visibility };
      setBoxes((prev) => prev.map((b) => (b.id === box.id ? updated : b)));
      setSharing(updated);
    } catch (err) {
      console.error(err);
      toast('เปลี่ยนการแชร์ไม่สำเร็จ', 'error');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (isOpen && currentUser) {
      loadBoxes();
    }
  }, [isOpen, currentUser]);

  const loadBoxes = async () => {
    try {
      setLoading(true);
      const data = await getUserBoxes(currentUser.uid);
      setBoxes(data);
    } catch (err) {
      console.error(err);
      toast('โหลด Gallery ไม่สำเร็จ', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('ต้องการลบดีไซน์นี้ใช่ไหม?')) return;
    try {
      await deleteBox(id);
      setBoxes(boxes.filter(b => b.id !== id));
      toast('ลบสำเร็จแล้ว', 'success');
    } catch (err) {
      console.error(err);
      toast('ลบไม่สำเร็จ กรุณาลองใหม่', 'error');
    }
  };

  const handleLoad = (box) => {
    // Pass the saved config back to the parent
    onLoadBox({
      facesConfig: box.facesConfig,
      activeNetId: box.activeNetId,
      netFlipX: box.netFlipX || false,
      netFlipY: box.netFlipY || false,
      netRotation: box.netRotation || 0,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="relative bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[80vh] rounded-2xl shadow-xl flex flex-col border border-slate-200 dark:border-slate-800 animate-in slide-in-from-bottom-4 duration-300">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Box size={20} className="text-indigo-500" />
              My Gallery
            </h2>
            <p className="text-xs text-slate-500 mt-1">Your saved 3D Box Configurations</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 dark:bg-slate-900/50">
          {loading ? (
            <div className="h-full flex flex-col justify-center items-center text-slate-400">
              <Loader2 size={32} className="animate-spin mb-4 text-indigo-500" />
              <p>Loading your creations...</p>
            </div>
          ) : boxes.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              <Box size={48} className="mb-4 text-slate-300 dark:text-slate-600" />
              <p className="font-medium text-slate-500 dark:text-slate-400">No boxes saved yet!</p>
              <p className="text-sm">Click "Save Box" in the sidebar to add one.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {boxes.map(box => (
                <div 
                  key={box.id} 
                  className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-sm hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700 transition-all cursor-pointer flex flex-col"
                  onClick={() => handleLoad(box)}
                >
                  <div className="aspect-video bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center border-b border-slate-100 dark:border-slate-700 relative overflow-hidden">
                    {/* Visual hint of the config could go here, for now a nice icon */}
                    <Box size={40} className="text-indigo-200 dark:text-indigo-500/50 transform group-hover:scale-110 transition-transform duration-500" />
                    
                    {/* Thumbnails of textures if they exist */}
                    <div className="absolute inset-0 flex flex-wrap opacity-20 group-hover:opacity-40 transition-opacity">
                       {Object.keys(box.facesConfig).slice(0,4).map(k => 
                          box.facesConfig[k].textureUrl ? 
                          <img key={k} src={box.facesConfig[k].textureUrl} className="w-1/2 h-1/2 object-cover" /> : null
                       )}
                    </div>
                  </div>
                  
                  <div className="p-4 flex flex-col flex-1">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 min-w-0">
                        {box.visibility === 'public' && <Globe size={14} className="text-emerald-500 shrink-0" aria-label="public" />}
                        <span className="truncate">{box.title || "Untitled Box"}</span>
                      </h3>
                      <button
                        onClick={(e) => { e.stopPropagation(); setSharing(box); }}
                        title={t('share')}
                        aria-label={t('share')}
                        className="ml-auto text-slate-400 hover:text-indigo-500 bg-slate-50 dark:bg-slate-700 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 p-1.5 rounded-lg transition-colors"
                      >
                        <Share2 size={16} />
                      </button>
                      <button 
                        onClick={(e) => handleDelete(e, box.id)}
                        className="text-slate-400 hover:text-red-500 bg-slate-50 dark:bg-slate-700 hover:bg-red-50 dark:hover:bg-red-900/30 p-1.5 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-4 mt-auto">
                      <Calendar size={12} />
                      {box.createdAt ? new Date(box.createdAt.toMillis()).toLocaleString() : "Just now"}
                    </div>

                    <button className="w-full py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-medium text-sm rounded-lg transition-colors">
                      Load Setup
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {sharing && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/40 rounded-2xl p-4" onClick={() => setSharing(null)}>
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 truncate">{sharing.title || 'Untitled Box'}</h3>
                <button onClick={() => setSharing(null)} aria-label={t('quizClose')} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"><X size={16} /></button>
              </div>
              {sharing.visibility === 'public' ? (
                <>
                  <p className="text-xs text-emerald-600 flex items-center gap-1.5"><Globe size={14} />{t('shareBoxPublic')}</p>
                  <QrBlock link={buildShareLink(appBaseUrl(), { box: sharing.id })} fileName={`foldify-box-${sharing.id}.png`} />
                  <button disabled={busy} onClick={() => setVisibility(sharing, 'private')} className="w-full py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 disabled:opacity-50">
                    {t('shareMakePrivate')}
                  </button>
                </>
              ) : (
                <button disabled={busy} onClick={() => setVisibility(sharing, 'public')} className="w-full py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 flex items-center justify-center gap-2">
                  {busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
                  {t('shareMakePublic')}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
