import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Copy, Check, Download, Loader2 } from "lucide-react";
import Modal, { Toggle } from "../ui/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { saveBoxConfig } from "../../services/db";
import { drawNet, faceImages } from "../../lib/cubeQuiz";
import { drawShapes } from "../../lib/shapes";
import { useLang } from "../../contexts/LanguageContext";
import { appBaseUrl, buildShareLink, facesToLabels } from "../../lib/shareLink";

/** Link + QR code with copy / download buttons. */
export function QrBlock({ link, fileName = "foldify-qr.png" }) {
  const { t } = useLang();
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link, { margin: 2, width: 640, errorCorrectionLevel: "M" })
      .then((url) => { if (!cancelled) setQr({ link, url }); })
      .catch(() => { if (!cancelled) setQr(null); });
    return () => { cancelled = true; };
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked: the link is still selectable in the box
    }
  };

  const qrUrl = qr?.link === link ? qr.url : null;

  return (
    <div className="flex flex-col sm:flex-row gap-4 items-center">
      <div className="w-40 h-40 shrink-0 rounded-2xl bg-white border border-line flex items-center justify-center overflow-hidden">
        {qrUrl ? <img src={qrUrl} alt="QR code" data-testid="share-qr" className="w-full h-full anim-pop" key={qrUrl} /> : <QrCode className="text-muted" size={40} />}
      </div>
      <div className="flex-1 w-full space-y-2 min-w-0">
        <input
          readOnly
          value={link}
          data-testid="share-link"
          onFocus={(e) => e.target.select()}
          className="field text-xs"
        />
        <div className="flex gap-2">
          <button onClick={copy} className="btn btn-primary flex-1">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t("shareCopied") : t("shareCopy")}
          </button>
          <a
            href={qrUrl || undefined}
            download={fileName}
            aria-disabled={!qrUrl}
            className={`btn btn-soft flex-1 ${qrUrl ? "" : "pointer-events-none opacity-50"}`}
          >
            <Download size={16} />
            {t("shareDownloadQr")}
          </a>
        </div>
      </div>
    </div>
  );
}

// Links made for a box in this session, so re-opening Share doesn't save a copy again.
const sharedBoxes = new Map(); // JSON of the design -> box id

/** The current net drawn with the real faces (pictures, colours, shapes). */
function NetPreview({ facesConfig, netIndex, transform }) {
  const ref = useRef(null);
  useEffect(() => {
    let cancelled = false;
    faceImages(facesConfig, drawShapes).then((images) => {
      if (cancelled || !ref.current) return;
      const W = 420, H = 300;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      c.style.cssText = "width:100%;height:100%;display:block";
      drawNet(c.getContext("2d"), { netIndex, transform, cells: null }, images, W, H);
      ref.current.replaceChildren(c);
    });
    return () => { cancelled = true; };
  }, [facesConfig, netIndex, transform]);
  return <div ref={ref} className="mx-auto w-full max-w-[420px] aspect-[7/5]" data-testid="share-preview" />;
}

/**
 * Share the box as it is now.
 *  - Letters only (typed in Decorate): the link carries the letters itself, no sign-in.
 *  - Pictures, colours or shapes: a copy is saved as a public box (sign-in) and shared by id.
 */
export default function ShareModal({ onClose, netIndex, transform, faceLabels, foldProgress, facesConfig, labelOnly, onSignIn }) {
  const { t } = useLang();
  const toast = useToast();
  const { currentUser } = useAuth();
  const letters = useMemo(() => facesToLabels(netIndex, transform, faceLabels), [netIndex, transform, faceLabels]);
  const [startFolded, setStartFolded] = useState(foldProgress > 0.5);
  const [startQuiz, setStartQuiz] = useState(false);
  const designKey = useMemo(() => JSON.stringify({ facesConfig, netIndex, transform }), [facesConfig, netIndex, transform]);
  const [boxId, setBoxId] = useState(() => sharedBoxes.get(designKey) || null);
  const [saving, setSaving] = useState(false);

  const fold = startFolded ? 1 : 0;
  const link = labelOnly
    ? buildShareLink(appBaseUrl(), { netIndex, transform, labels: letters.labels, turns: letters.turns, fold, quiz: startQuiz })
    : boxId && buildShareLink(appBaseUrl(), { box: boxId, fold, quiz: startQuiz });

  const shareBox = async () => {
    try {
      setSaving(true);
      const id = await saveBoxConfig(currentUser.uid, {
        facesConfig,
        activeNetId: netIndex,
        netFlipX: !!transform.flipX,
        netFlipY: !!transform.flipY,
        netRotation: transform.rotation || 0,
        visibility: "public",
        title: `${t("sharedTitle")} ${new Date().toLocaleDateString()}`,
      });
      sharedBoxes.set(designKey, id);
      setBoxId(id);
    } catch (err) {
      console.error(err);
      toast(t("shareBoxFailed"), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={t("shareTitle")} subtitle={t("shareSubtitle")} icon={QrCode} onClose={onClose} size="md" testId="share">
      <div className="space-y-5">
        <div className="rounded-2xl bg-white border border-line p-3">
          <NetPreview facesConfig={facesConfig} netIndex={netIndex} transform={transform} />
        </div>
        {/* two switches, with a thin line between them */}
        <div className="grid sm:grid-cols-2 rounded-2xl border border-line divide-y sm:divide-y-0 sm:divide-x divide-line" data-testid="share-options">
          <div className="px-4"><Toggle label={t("shareStartFolded")} checked={startFolded} onChange={setStartFolded} /></div>
          <div className="px-4"><Toggle label={t("shareStartQuiz")} checked={startQuiz} onChange={setStartQuiz} testId="share-quiz" /></div>
        </div>
        {link ? (
          <>
            <QrBlock link={link} fileName={`foldify-net${netIndex + 1}.png`} />
            {labelOnly && <p className="hint">{t("shareBoxLetters")}</p>}
          </>
        ) : !currentUser ? (
          <div className="rounded-2xl border border-dashed border-line p-4 space-y-3 text-center">
            <p className="text-sm">{t("shareNeedsSignIn")}</p>
            <button className="btn btn-primary" onClick={onSignIn} data-testid="share-signin">{t("loginRegister")}</button>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-4 space-y-3 text-center">
            <p className="text-sm">{t("shareMakeLinkHint")}</p>
            <button className="btn btn-primary" onClick={shareBox} disabled={saving} data-testid="share-make-box-link">
              {saving && <Loader2 size={16} className="animate-spin" />}
              {t("shareMakeLink")}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
