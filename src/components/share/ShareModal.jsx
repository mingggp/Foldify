import { useEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import { QrCode, Copy, Check, Download, RotateCw, Loader2 } from "lucide-react";
import Modal, { Toggle, Segmented } from "../ui/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { useToast } from "../../contexts/ToastContext";
import { saveBoxConfig } from "../../services/db";
import { drawNet, faceImages } from "../../lib/cubeQuiz";
import { drawShapes } from "../../lib/shapes";
import { useLang } from "../../contexts/LanguageContext";
import { appBaseUrl, buildShareLink, facesToLabels, MAX_LABEL_LENGTH, paperOrder, splitGraphemes } from "../../lib/shareLink";

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

const clampLabel = (v) => splitGraphemes(v.normalize("NFC")).slice(0, MAX_LABEL_LENGTH).join("");

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
 * Share dialog.
 *  - "This box": the box as it is now. A box of letters only becomes a plain link; a box with
 *    pictures, colours or shapes is saved as a public copy (needs sign-in) and shared by id.
 *  - "Worksheet letters": type a label on each square for a worksheet QR code.
 */
export default function ShareModal({ onClose, netIndex, transform, faceLabels, foldProgress, onApply, facesConfig, labelOnly, onSignIn }) {
  const { t } = useLang();
  const toast = useToast();
  const { currentUser } = useAuth();
  const [tab, setTab] = useState("box");
  const order = useMemo(() => paperOrder(netIndex, transform), [netIndex, transform]);
  const initial = useMemo(() => facesToLabels(netIndex, transform, faceLabels), [netIndex, transform, faceLabels]);
  const [labels, setLabels] = useState(initial.labels);
  const [turns, setTurns] = useState(initial.turns);
  const [startFolded, setStartFolded] = useState(foldProgress > 0.5);
  const [startQuiz, setStartQuiz] = useState(false);
  const designKey = useMemo(() => JSON.stringify({ facesConfig, netIndex, transform }), [facesConfig, netIndex, transform]);
  const [boxId, setBoxId] = useState(() => sharedBoxes.get(designKey) || null);
  const [saving, setSaving] = useState(false);

  const fold = startFolded ? 1 : 0;
  const link = buildShareLink(appBaseUrl(), { netIndex, transform, labels, turns, fold, quiz: startQuiz });
  const boxLink = labelOnly
    ? buildShareLink(appBaseUrl(), { netIndex, transform, labels: initial.labels, turns: initial.turns, fold, quiz: startQuiz })
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

  const toggles = (
    <div className="grid sm:grid-cols-2 gap-x-6">
      <Toggle label={t("shareStartFolded")} checked={startFolded} onChange={setStartFolded} />
      <Toggle label={t("shareStartQuiz")} checked={startQuiz} onChange={setStartQuiz} testId="share-quiz" />
    </div>
  );

  const cell = 60;
  return (
    <Modal title={t("shareTitle")} icon={QrCode} onClose={onClose} size="md" testId="share">
      <div className="space-y-5">
        <Segmented
          full
          size="md"
          value={tab}
          onChange={setTab}
          label={t("shareTitle")}
          options={[
            { value: "box", label: t("shareTabBox") },
            { value: "labels", label: t("shareTabLabels") },
          ]}
        />

        {tab === "box" && (
          <div className="space-y-5 anim-rise" key="box">
            <div className="rounded-2xl bg-white border border-line p-3">
              <NetPreview facesConfig={facesConfig} netIndex={netIndex} transform={transform} />
            </div>
            {toggles}
            {boxLink ? (
              <>
                <QrBlock link={boxLink} fileName={`foldify-box-net${netIndex + 1}.png`} />
                <p className="hint">{labelOnly ? t("shareBoxLetters") : t("shareBoxSaved")}</p>
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
        )}

        {tab === "labels" && (
        <div className="space-y-5 anim-rise" key="labels">
        <p className="hint">{t("shareHint")}</p>
        {/* The net, square by square, as it appears on screen */}
        <div className="flex justify-center rounded-2xl bg-surface-2 border border-line py-5">
          <div className="relative" style={{ width: order.columns * cell, height: order.rows * cell }} data-testid="share-net">
            {order.cells.map((c, i) => (
              <div
                key={c.path}
                className="absolute border-2 border-line bg-surface rounded-lg flex items-center justify-center focus-within:border-mint transition-colors"
                style={{ left: c.x * cell, top: c.y * cell, width: cell - 4, height: cell - 4 }}
              >
                <input
                  value={labels[i]}
                  aria-label={`${t("square")} ${i + 1}`}
                  data-testid={`share-label-${i}`}
                  onChange={(e) => setLabels((prev) => prev.map((l, j) => (j === i ? clampLabel(e.target.value) : l)))}
                  className="w-full h-full text-center bg-transparent text-xl font-display font-bold focus:outline-none rounded-md transition-transform duration-300"
                  style={{ transform: `rotate(${turns[i] * 90}deg)` }}
                />
                <button
                  type="button"
                  title={t("shareTurn")}
                  aria-label={`${t("shareTurn")} (${i + 1})`}
                  data-testid={`share-turn-${i}`}
                  onClick={() => setTurns((prev) => prev.map((v, j) => (j === i ? (v + 1) % 4 : v)))}
                  className="absolute -top-2 -right-2 w-6 h-6 grid place-items-center rounded-full bg-surface border border-line text-muted hover:text-brand-ink hover:border-mint shadow-sm"
                >
                  <RotateCw size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {toggles}

        <QrBlock link={link} fileName={`foldify-net${netIndex + 1}.png`} />

        <button onClick={() => onApply(labels, turns)} className="btn btn-soft w-full">
          {t("shareApply")}
        </button>
        </div>
        )}
      </div>
    </Modal>
  );
}
