import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { X, QrCode, Copy, Check, Download, RotateCw } from "lucide-react";
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
      <div className="w-40 h-40 shrink-0 rounded-xl bg-white border border-slate-200 dark:border-slate-700 flex items-center justify-center overflow-hidden">
        {qrUrl ? <img src={qrUrl} alt="QR code" data-testid="share-qr" className="w-full h-full" /> : <QrCode className="text-slate-300" size={40} />}
      </div>
      <div className="flex-1 w-full space-y-2 min-w-0">
        <input
          readOnly
          value={link}
          data-testid="share-link"
          onFocus={(e) => e.target.select()}
          className="w-full text-xs font-mono px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
        />
        <div className="flex gap-2">
          <button onClick={copy} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white">
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? t("shareCopied") : t("shareCopy")}
          </button>
          <a
            href={qrUrl || undefined}
            download={fileName}
            aria-disabled={!qrUrl}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
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

/**
 * Worksheet link builder: type a label on each square of the current net,
 * get a link + QR code. The net shown is exactly the one on screen.
 */
export default function ShareModal({ onClose, netIndex, transform, faceLabels, foldProgress, onApply }) {
  const { t } = useLang();
  const order = useMemo(() => paperOrder(netIndex, transform), [netIndex, transform]);
  const initial = useMemo(() => facesToLabels(netIndex, transform, faceLabels), [netIndex, transform, faceLabels]);
  const [labels, setLabels] = useState(initial.labels);
  const [turns, setTurns] = useState(initial.turns);
  const [startFolded, setStartFolded] = useState(foldProgress > 0.5);
  const [startQuiz, setStartQuiz] = useState(false);

  const link = buildShareLink(appBaseUrl(), {
    netIndex,
    transform,
    labels,
    turns,
    fold: startFolded ? 1 : 0,
    quiz: startQuiz,
  });

  const cell = 56;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        className="bg-white dark:bg-slate-900 w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
          <h2 id="share-title" className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <QrCode size={20} className="text-indigo-500" />
            {t("shareTitle")}
          </h2>
          <button onClick={onClose} aria-label={t("quizClose")} className="p-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">{t("shareHint")}</p>

          {/* The net, square by square, as it appears on screen */}
          <div className="flex justify-center">
            <div className="relative" style={{ width: order.columns * cell, height: order.rows * cell }} data-testid="share-net">
              {order.cells.map((c, i) => (
                <div
                  key={c.path}
                  className="absolute border-2 border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 rounded-md flex items-center justify-center"
                  style={{ left: c.x * cell, top: c.y * cell, width: cell - 4, height: cell - 4 }}
                >
                  <input
                    value={labels[i]}
                    aria-label={`square ${i + 1}`}
                    data-testid={`share-label-${i}`}
                    onChange={(e) => setLabels((prev) => prev.map((l, j) => (j === i ? clampLabel(e.target.value) : l)))}
                    className="w-full h-full text-center bg-transparent text-lg font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-md transition-transform"
                    style={{ transform: `rotate(${turns[i] * 90}deg)` }}
                  />
                  <button
                    type="button"
                    title={t("shareTurn")}
                    aria-label={`${t("shareTurn")} (${i + 1})`}
                    data-testid={`share-turn-${i}`}
                    onClick={() => setTurns((prev) => prev.map((v, j) => (j === i ? (v + 1) % 4 : v)))}
                    className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-indigo-600"
                  >
                    <RotateCw size={10} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm text-slate-700 dark:text-slate-300">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={startFolded} onChange={(e) => setStartFolded(e.target.checked)} className="accent-indigo-600" />
              {t("shareStartFolded")}
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={startQuiz} onChange={(e) => setStartQuiz(e.target.checked)} className="accent-indigo-600" data-testid="share-quiz" />
              {t("shareStartQuiz")}
            </label>
          </div>

          <QrBlock link={link} fileName={`foldify-net${netIndex + 1}.png`} />

          <button
            onClick={() => onApply(labels, turns)}
            className="w-full py-2 rounded-lg text-sm font-medium border border-indigo-300 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
          >
            {t("shareApply")}
          </button>
        </div>
      </div>
    </div>
  );
}
