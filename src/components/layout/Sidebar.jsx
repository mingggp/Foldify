import { Download, Settings, X, ImagePlus, Trash2, FlipHorizontal, FlipVertical, RotateCcw, RotateCw, Undo2, Redo2, Shapes, Loader2, Save, LogOut, LogIn, Images, ScanLine, Copy, ClipboardPaste, Shuffle, Eraser, Plus } from "lucide-react";
import { useState, useRef } from "react";
import NetSelector from "../NetSelector";
import Logo from "../ui/Logo";
import ScanHelp from "./ScanHelp";
import { Segmented, Range } from "../ui/Modal";
import { useAuth } from "../../contexts/AuthContext";
import { MAX_LABEL_LENGTH, splitGraphemes } from "../../lib/shareLink";
import { saveBoxConfig } from "../../services/db";
import { useLang } from "../../contexts/LanguageContext";
import { analyzeNetImage } from "../../utils/SmartNetAnalyzer";
import { useToast } from "../../contexts/ToastContext";

const FACE_ORDER = ["top", "front", "left", "right", "back", "bottom"];
const SWATCHES = ["#ffffff", "#28a1ab", "#00c8b5", "#ffb238", "#ff7a59", "#f7a8c4", "#8b7cf6"];

function IconButton({ label, children, ...rest }) {
  return (
    <button title={label} aria-label={label} className="btn btn-ghost btn-icon" {...rest}>
      {children}
    </button>
  );
}

export default function Sidebar({ closeSidebar, quizOpen, onOpenShapeEditor, faceLabels = {}, onSetLabel, facesConfig, setFacesConfig, undoFaces, redoFaces, canUndo, canRedo, selectedFace, setSelectedFace, activeNetId, setActiveNetId, netFlipX, setNetFlipX, netFlipY, setNetFlipY, netRotation = 0, setNetRotation, setShowAuthModal, setShowGalleryModal, setShowSettingsModal, setShowExportModal }) {
  const [isSaving, setIsSaving] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [clipboardFaceConfig, setClipboardFaceConfig] = useState(null);
  const [tab, setTab] = useState("net");
  // clicking a face in 3D jumps to the "decorate" tab
  const [seenFace, setSeenFace] = useState(selectedFace);
  if (seenFace !== selectedFace) {
    setSeenFace(selectedFace);
    if (selectedFace && !quizOpen) setTab("face");
  }

  const { currentUser, logout } = useAuth();
  const { t } = useLang();
  const toast = useToast();
  const smartScanInputRef = useRef(null);

  const face = selectedFace ? facesConfig[selectedFace] : null;

  const handleSmartScan = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setIsScanning(true);
    try {
      const result = await analyzeNetImage(file);
      setActiveNetId(result.activeNetId);
      setNetFlipX(result.netFlipX);
      setNetFlipY(result.netFlipY);
      setNetRotation?.(result.netRotation);
      setFacesConfig((prev) => {
        const next = { ...prev };
        for (const id of FACE_ORDER) {
          if (result.extractedFaces[id]) next[id] = { ...next[id], textureUrl: result.extractedFaces[id] };
        }
        return next;
      });
      toast(t("scanDone"), "success");
      closeSidebar?.();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setIsScanning(false);
    }
  };

  const handleRandomize = () => {
    setFacesConfig((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = { ...next[key], color: SWATCHES[1 + Math.floor(Math.random() * (SWATCHES.length - 1))] };
      });
      return next;
    });
  };

  const handleSetAllWhite = () => {
    setFacesConfig((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        next[key] = { ...next[key], color: "#ffffff", textureUrl: null, userImageUrl: null, aiImageUrl: null, shapes: [], activeShapeIndex: null };
      });
      return next;
    });
  };

  const handleSaveBox = async () => {
    if (!currentUser) return setShowAuthModal(true);
    try {
      setIsSaving(true);
      await saveBoxConfig(currentUser.uid, { facesConfig, activeNetId, netFlipX, netFlipY, netRotation });
      toast(t("saved"), "success");
    } catch (err) {
      console.error(err);
      toast(t("saveFailed"), "error");
    } finally {
      setIsSaving(false);
    }
  };

  const updateFaceConfig = (key, value) => {
    if (!selectedFace) return;
    setFacesConfig((prev) => ({ ...prev, [selectedFace]: { ...prev[selectedFace], [key]: value } }));
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    updateFaceConfig("textureUrl", URL.createObjectURL(file));
  };


  return (
    <aside className="glass glass-panel max-lg:bg-surface h-full lg:rounded-[26px] flex flex-col overflow-hidden">
      {/* header: the wordmark, centred. Settings sit in the top bar on large screens,
          and here (left, opposite the close button) in the drawer on small ones. */}
      <div className="relative px-4 pt-5 pb-4 flex items-center justify-center">
        <span className="lg:hidden absolute left-3 top-1/2 -translate-y-1/2">
          <IconButton label={t("settings")} onClick={() => setShowSettingsModal(true)}>
            <Settings size={19} />
          </IconButton>
        </span>
        <Logo />
        <span className="lg:hidden absolute right-3 top-1/2 -translate-y-1/2">
          <IconButton label={t("close")} onClick={closeSidebar}>
            <X size={19} />
          </IconButton>
        </span>
      </div>

      <div className="flex-1 overflow-y-auto scroll-area scrollbar-hide px-4 pb-4 space-y-4">
        {/* Smart Scan — the most used action, always on top, with a moving border to stand out */}
        <div className="relative ring-anim scan-card rounded-2xl">
          <button
            type="button"
            onClick={() => smartScanInputRef.current?.click()}
            disabled={isScanning}
            data-testid="smart-scan"
            className="group relative w-full text-left rounded-2xl bg-surface overflow-hidden transition-transform active:scale-[0.99]"
          >
            <span className="scan-shine" aria-hidden="true" />
            <span className="relative flex items-center gap-3 px-4 py-3.5 pr-11">
              <span className="relative grid place-items-center w-12 h-12 rounded-xl bg-mint/15 text-brand-ink shrink-0 overflow-hidden">
                {isScanning ? <Loader2 size={24} className="animate-spin" /> : <ScanLine size={24} />}
                <span className={`absolute inset-x-1.5 top-1/2 h-0.5 bg-mint rounded-full ${isScanning ? "animate-[scanline_1.1s_ease-in-out_infinite]" : "animate-[scanline_2.4s_ease-in-out_infinite]"}`} />
              </span>
              <span className="min-w-0">
                <span className="block font-display font-semibold text-[15px] leading-tight">{isScanning ? t("scanBusy") : t("scanTitle")}</span>
                <span className="block hint mt-1">{t("scanHint")}</span>
              </span>
            </span>
          </button>
          <span className="absolute top-2 right-2">
            <ScanHelp />
          </span>
        </div>
        <input type="file" ref={smartScanInputRef} className="hidden" accept="image/*" onChange={handleSmartScan} />

        <Segmented
          value={tab}
          onChange={setTab}
          label={t("panel")}
          size="md"
          full
          options={[
            { value: "net", label: t("tabNet") },
            { value: "face", label: t("tabFace") },
          ]}
        />

        {tab === "net" && (
          <section className="space-y-3 anim-rise" key="net">
            <NetSelector activeNetId={activeNetId} setActiveNetId={setActiveNetId} netFlipX={netFlipX} netFlipY={netFlipY} netRotation={netRotation} />
            <div className="grid grid-cols-3 gap-2">
              <button onClick={() => setNetRotation?.((netRotation + 1) % 4)} className={`btn btn-soft text-xs flex-col h-14 gap-1 ${netRotation ? "btn-on" : ""}`} aria-label="Rotate net 90 degrees">
                <RotateCw size={17} />
                {t("netRotate")}
              </button>
              <button onClick={() => setNetFlipX(!netFlipX)} aria-pressed={netFlipX} className={`btn btn-soft text-xs flex-col h-14 gap-1 ${netFlipX ? "btn-on" : ""}`}>
                <FlipHorizontal size={17} />
                {t("netFlipH")}
              </button>
              <button onClick={() => setNetFlipY(!netFlipY)} aria-pressed={netFlipY} className={`btn btn-soft text-xs flex-col h-14 gap-1 ${netFlipY ? "btn-on" : ""}`}>
                <FlipVertical size={17} />
                {t("netFlipV")}
              </button>
            </div>
            <p className="hint">{t("netHint")}</p>
          </section>
        )}

        {tab === "face" && (
          <section className="space-y-4 anim-rise" key="face">
            {/* which face */}
            <div className="grid grid-cols-6 gap-1.5" role="radiogroup" aria-label={t("pickFace")}>
              {FACE_ORDER.map((id) => {
                const f = facesConfig[id];
                const on = selectedFace === id;
                return (
                  <button
                    key={id}
                    role="radio"
                    aria-checked={on}
                    data-testid={`face-chip-${id}`}
                    onClick={() => setSelectedFace(id)}
                    className={`relative flex flex-col items-center gap-1 rounded-xl py-1.5 border transition-colors ${on ? "ring-anim border-transparent bg-spark/10" : "border-transparent hover:bg-surface-2"}`}
                  >
                    <span className="w-7 h-7 rounded-md border border-line bg-center bg-cover" style={{ backgroundColor: f.color, backgroundImage: f.textureUrl ? `url("${f.textureUrl}")` : undefined }} />
                    <span className="text-[11px] font-semibold leading-none">{t(`face_${id}`)}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between -mx-1">
              <div className="flex">
                <IconButton label={t("undo")} onClick={undoFaces} disabled={!canUndo}><Undo2 size={17} /></IconButton>
                <IconButton label={t("redo")} onClick={redoFaces} disabled={!canRedo}><Redo2 size={17} /></IconButton>
                <IconButton label={t("copyFace")} onClick={() => face && setClipboardFaceConfig(face)} disabled={!face}><Copy size={17} /></IconButton>
                <IconButton label={t("pasteFace")} onClick={() => setFacesConfig((prev) => ({ ...prev, [selectedFace]: { ...clipboardFaceConfig } }))} disabled={!face || !clipboardFaceConfig}><ClipboardPaste size={17} /></IconButton>
              </div>
              <div className="flex">
                <IconButton label={t("randomize")} onClick={handleRandomize}><Shuffle size={17} /></IconButton>
                <IconButton label={t("clearAll")} onClick={handleSetAllWhite}><Eraser size={17} /></IconButton>
              </div>
            </div>

            {!face ? (
              <p className="hint rounded-xl border border-dashed border-line p-4 text-center">{t("noFaceSelected")}</p>
            ) : (
              <>
                {/* colour */}
                <div className="space-y-2">
                  <h3 className="section-title">{t("faceColor")}</h3>
                  <div className="grid grid-cols-8 gap-1.5">
                    {SWATCHES.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateFaceConfig("color", c)}
                        aria-label={c}
                        aria-pressed={face.color === c}
                        className={`aspect-square rounded-lg border transition-transform hover:scale-105 ${face.color === c ? "ring-2 ring-mint ring-offset-2 ring-offset-surface border-transparent" : "border-line"}`}
                        style={{ background: c }}
                      />
                    ))}
                    <label className="aspect-square rounded-lg border border-line grid place-items-center cursor-pointer relative overflow-hidden" title={t("customColor")} style={{ background: "conic-gradient(#ff7a59,#ffb238,#9be15d,#00c8b5,#4f8ef7,#8b7cf6,#f7a8c4,#ff7a59)" }}>
                      <Plus size={14} className="text-white drop-shadow" />
                      <input type="color" value={face.color} onChange={(e) => updateFaceConfig("color", e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" aria-label={t("customColor")} />
                    </label>
                  </div>
                </div>

                {/* letter */}
                <div className="space-y-2">
                  <h3 className="section-title">{t("letter")}</h3>
                  <input
                    value={faceLabels[selectedFace]?.label || ""}
                    onChange={(e) => onSetLabel?.(selectedFace, splitGraphemes(e.target.value.normalize("NFC")).slice(0, MAX_LABEL_LENGTH).join(""))}
                    placeholder={t("letterPlaceholder")}
                    aria-label={t("letter")}
                    data-testid="face-letter"
                    className="field h-12 text-center text-xl font-display font-bold"
                  />
                  {face.textureUrl && !faceLabels[selectedFace] && <p className="hint">{t("letterReplaces")}</p>}
                </div>

                {/* picture */}
                <div className="space-y-2">
                  <h3 className="section-title">{t("picture")}</h3>
                  {face.textureUrl ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 rounded-xl border border-line p-2 bg-surface-2">
                        <img src={face.textureUrl} alt="" className="w-12 h-12 rounded-lg object-cover bg-white" style={{ transform: `rotate(${face.rotation}deg) scale(${face.flipX ? -1 : 1}, ${face.flipY ? -1 : 1})` }} />
                        <span className="flex-1 text-sm text-muted">{face.rotation}°</span>
                        <IconButton label={t("removePicture")} onClick={() => updateFaceConfig("textureUrl", null)}><Trash2 size={17} /></IconButton>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        <button className="btn btn-soft btn-icon" title={t("turnLeft")} aria-label={t("turnLeft")} onClick={() => updateFaceConfig("rotation", (face.rotation - 90 + 360) % 360)}><RotateCcw size={16} /></button>
                        <button className="btn btn-soft btn-icon" title={t("turnRight")} aria-label={t("turnRight")} onClick={() => updateFaceConfig("rotation", (face.rotation + 90) % 360)}><RotateCw size={16} /></button>
                        <button className={`btn btn-soft btn-icon ${face.flipX ? "btn-on" : ""}`} title={t("flipH")} aria-label={t("flipH")} aria-pressed={!!face.flipX} onClick={() => updateFaceConfig("flipX", !face.flipX)}><FlipHorizontal size={16} /></button>
                        <button className={`btn btn-soft btn-icon ${face.flipY ? "btn-on" : ""}`} title={t("flipV")} aria-label={t("flipV")} aria-pressed={!!face.flipY} onClick={() => updateFaceConfig("flipY", !face.flipY)}><FlipVertical size={16} /></button>
                      </div>
                      <Range min={0} max={359} step={1} value={face.rotation} onChange={(v) => updateFaceConfig("rotation", v)} className="w-full" aria-label={t("pictureAngle")} />
                    </div>
                  ) : (
                    <label className="btn btn-soft w-full h-12 border-dashed cursor-pointer">
                      <ImagePlus size={18} className="text-brand-ink" />
                      {t("uploadPicture")}
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>

                {/* shapes */}
                <div className="space-y-2">
                  <h3 className="section-title">{t("stickers")}</h3>
                  <button onClick={onOpenShapeEditor} className="btn btn-soft w-full h-12" data-testid="open-shape-editor">
                    <Shapes size={18} className="text-brand-ink" />
                    {t("editShapes")}
                  </button>
                  <p className="hint">{face.shapes?.length ? t("shapesCount").replace("{n}", face.shapes.length) : t("shapesNone")}</p>
                </div>
              </>
            )}
          </section>
        )}
      </div>

      {/* footer: account + keep / export */}
      <div className="px-4 py-3 border-t border-line space-y-2.5">
        {currentUser ? (
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-mint/20 text-brand-ink grid place-items-center text-sm font-bold shrink-0">{currentUser.email?.charAt(0).toUpperCase()}</span>
            <span className="flex-1 text-sm truncate text-muted">{currentUser.email}</span>
            <IconButton label={t("logout")} onClick={logout}><LogOut size={16} /></IconButton>
          </div>
        ) : (
          <button onClick={() => setShowAuthModal(true)} className="btn btn-ghost w-full text-brand-ink">
            <LogIn size={17} />
            {t("loginRegister")}
          </button>
        )}
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <button onClick={handleSaveBox} disabled={isSaving} className="btn btn-primary">
            {isSaving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            {isSaving ? t("saving") : t("saveBox")}
          </button>
          <button onClick={() => (currentUser ? setShowGalleryModal(true) : setShowAuthModal(true))} className="btn btn-soft">
            <Images size={17} />
            {t("myGallery")}
          </button>
          <button onClick={() => setShowExportModal(true)} data-testid="open-export" className="btn btn-soft btn-icon" title={t("exportImage")} aria-label={t("exportImage")}>
            <Download size={17} />
          </button>
        </div>
      </div>
    </aside>
  );
}
