import { useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getUserBoxes, deleteBox, setBoxVisibility } from "../../services/db";
import { Loader2, Trash2, Images, Share2, Globe, ArrowLeft } from "lucide-react";
import { QrBlock } from "../share/ShareModal";
import { appBaseUrl, buildShareLink } from "../../lib/shareLink";
import { useLang } from "../../contexts/LanguageContext";
import { useToast } from "../../contexts/ToastContext";
import Modal from "../ui/Modal";
import NetThumb from "./NetThumb";

export default function GalleryModal({ isOpen, onClose, onLoadBox }) {
  const { currentUser } = useAuth();
  const toast = useToast();
  const { t, lang } = useLang();
  const [boxes, setBoxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(null); // box being shared
  const [busy, setBusy] = useState(false);

  const setVisibility = async (box, visibility) => {
    try {
      setBusy(true);
      await setBoxVisibility(box.id, visibility);
      const updated = { ...box, visibility };
      setBoxes((prev) => prev.map((b) => (b.id === box.id ? updated : b)));
      setSharing(updated);
    } catch (err) {
      console.error(err);
      toast(t("shareChangeFailed"), "error");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !currentUser) return;
    let cancelled = false;
    getUserBoxes(currentUser.uid)
      .then((data) => { if (!cancelled) setBoxes(data); })
      .catch((err) => { console.error(err); if (!cancelled) toast(t("galleryLoadFailed"), "error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // t / toast are stable enough; reload only when opened or the user changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentUser]);

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      await deleteBox(id);
      setBoxes((prev) => prev.filter((b) => b.id !== id));
      toast(t("deleted"), "success");
    } catch (err) {
      console.error(err);
      toast(t("deleteFailed"), "error");
    }
  };

  const handleLoad = (box) => {
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

  if (sharing) {
    return (
      <Modal title={sharing.title || t("untitled")} icon={Share2} onClose={() => setSharing(null)} size="md" testId="gallery-share">
        <button onClick={() => setSharing(null)} className="btn btn-ghost -ml-2 mb-3">
          <ArrowLeft size={16} />
          {t("myGallery")}
        </button>
        {sharing.visibility === "public" ? (
          <div className="space-y-4">
            <p className="text-sm text-good flex items-center gap-1.5"><Globe size={15} />{t("shareBoxPublic")}</p>
            <QrBlock link={buildShareLink(appBaseUrl(), { box: sharing.id })} fileName={`foldify-box-${sharing.id}.png`} />
            <button disabled={busy} onClick={() => setVisibility(sharing, "private")} className="btn btn-soft w-full">
              {t("shareMakePrivate")}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="hint">{t("shareBoxExplain")}</p>
            <button disabled={busy} onClick={() => setVisibility(sharing, "public")} className="btn btn-primary w-full h-11">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
              {t("shareMakePublic")}
            </button>
          </div>
        )}
      </Modal>
    );
  }

  return (
    <Modal title={t("myGallery")} subtitle={t("gallerySubtitle")} icon={Images} onClose={onClose} size="lg" testId="gallery">
      {loading ? (
        <div className="py-16 grid place-items-center text-muted gap-3">
          <Loader2 size={28} className="animate-spin text-mint" />
          <p className="text-sm">{t("galleryLoading")}</p>
        </div>
      ) : boxes.length === 0 ? (
        <div className="py-14 grid place-items-center text-center gap-2 rounded-2xl border-2 border-dashed border-line">
          <Images size={36} className="text-muted" />
          <p className="font-semibold">{t("galleryEmpty")}</p>
          <p className="hint max-w-xs">{t("galleryEmptyHint")}</p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {boxes.map((box, i) => (
            <li key={box.id} className="anim-rise" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <div className="group h-full rounded-2xl border border-line bg-surface-2 hover:border-mint transition-colors flex flex-col overflow-hidden">
                <button onClick={() => handleLoad(box)} className="p-3 pb-1 text-left" aria-label={`${t("open")} ${box.title || t("untitled")}`}>
                  <NetThumb {...box} className="w-full transition-transform duration-300 group-hover:scale-[1.04]" />
                </button>
                <div className="px-3 pb-3 pt-1 flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate flex items-center gap-1">
                      {box.visibility === "public" && <Globe size={13} className="text-good shrink-0" aria-label={t("public")} />}
                      {box.title || t("untitled")}
                    </p>
                    <p className="text-[11px] text-muted truncate">
                      {box.createdAt?.toMillis ? new Date(box.createdAt.toMillis()).toLocaleDateString(lang === "th" ? "th-TH" : "en-GB", { day: "numeric", month: "short", year: "numeric" }) : ""}
                    </p>
                  </div>
                  <button onClick={() => setSharing(box)} title={t("share")} aria-label={t("share")} className="btn btn-ghost btn-icon w-9 min-w-9 min-h-9">
                    <Share2 size={16} />
                  </button>
                  <button onClick={(e) => handleDelete(e, box.id)} title={t("delete")} aria-label={t("delete")} className="btn btn-ghost btn-icon w-9 min-w-9 min-h-9 hover:text-bad">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
