import { useCallback, useEffect, useRef, useState } from "react";
import { CircleHelp, ArrowRight, Check, X, Loader2, Play } from "lucide-react";
import Modal, { Segmented } from "../ui/Modal";
import { useLang } from "../../contexts/LanguageContext";
import { cubeToNetQuestion, drawCubeView, drawNet, faceImages, makeLook, netToCubeQuestion } from "../../lib/cubeQuiz";
import { drawShapes } from "../../lib/shapes";
import { randomPracticeNet } from "../../lib/quiz";
import { makeLabelTexture } from "../../lib/labelTexture";

// pictures stay as canvases (encoding PNGs would only slow things down)
const toCanvas = (w, h, draw) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.style.cssText = "width:100%;height:100%;display:block";
  draw(c.getContext("2d"));
  return c;
};

/** shows a ready-made <canvas> element */
function CanvasView({ canvas, className, label }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.replaceChildren(canvas);
  }, [canvas]);
  return <span ref={ref} role="img" aria-label={label} className={className} />;
}

const practiceDesign = () => {
  const r = randomPracticeNet();
  const facesConfig = {};
  for (const [key, l] of Object.entries(r.faceLabels)) {
    facesConfig[key] = { color: "#ffffff", textureUrl: makeLabelTexture(l.label), rotation: (l.turn || 0) * 90, shapes: [] };
  }
  return { netIndex: r.netIndex, transform: r.transform, facesConfig };
};

/** Build one question (as pictures) from a design; null if the design can't make one. */
async function buildQuestion(design, kind, mode) {
  const images = await faceImages(design.facesConfig, drawShapes);
  const look = makeLook(images);
  const make = kind === "net2cube" ? netToCubeQuestion : cubeToNetQuestion;
  const q = make(design, look, mode);
  if (!q) return null;
  const S = 360;
  const question = kind === "net2cube"
    ? [toCanvas(S * 1.2, S, (ctx) => drawNet(ctx, q.question.net, images, S * 1.2, S))]
    : q.question.views.map((v) => toCanvas(S, S, (ctx) => drawCubeView(ctx, v, images, S, S)));
  const choices = q.choices.map((c) => ({
    right: c.right,
    url: kind === "net2cube" ? toCanvas(S, S, (ctx) => drawCubeView(ctx, c.view, images, S, S)) : toCanvas(S, S, (ctx) => drawNet(ctx, c.net, images, S, S)),
  }));
  return { id: Math.random().toString(36).slice(2), kind, mode, question, choices, answer: q.answer };
}

/**
 * "Guess before folding" as an exam question made from the user's own box:
 * a net with 5 folded-box choices, or a box (two views) with 5 net choices.
 */
export default function QuizModal({ design, onClose, onShowFold }) {
  const { t } = useLang();
  const [kind, setKind] = useState("random");
  const [mode, setMode] = useState("random");
  const [q, setQ] = useState(null);
  const [practice, setPractice] = useState(false);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const run = useRef(0);

  const next = useCallback(async (kindSel, modeSel) => {
    const id = ++run.current;
    setLoading(true);
    setPicked(null);
    const k = kindSel === "random" ? (Math.random() < 0.5 ? "net2cube" : "cube2net") : kindSel;
    const m = modeSel === "random" ? (Math.random() < 0.5 ? "correct" : "different") : modeSel;
    let built = null;
    let usedPractice = false;
    try {
      built = await buildQuestion(design, k, m);
      if (!built) {
        usedPractice = true;
        built = await buildQuestion(practiceDesign(), k, m);
      }
    } catch (err) {
      console.error(err);
    }
    if (id !== run.current) return;
    setQ(built);
    setPractice(usedPractice);
    setLoading(false);
  }, [design]);

  useEffect(() => {
    // first question as soon as the dialog opens
    next(kind, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const answer = (i) => {
    if (picked != null || !q) return;
    setPicked(i);
    setScore((s) => ({ right: s.right + (i === q.answer ? 1 : 0), total: s.total + 1 }));
  };

  const prompt = q ? t(`quiz_${q.kind}_${q.mode}`) : "";
  const correct = picked != null && picked === q?.answer;

  const footer = picked != null && q ? (
    <>
      <p aria-live="polite" data-testid="quiz-result" data-correct={correct} className={`flex items-center gap-2 font-semibold mr-auto ${correct ? "text-good" : "text-bad"}`}>
        {correct ? <Check size={18} /> : <X size={18} />}
        {correct ? t("quizCorrect") : t("quizWrongN").replace("{n}", q.answer + 1)}
      </p>
      {q.kind === "net2cube" && !practice && (
        <button className="btn btn-soft" onClick={onShowFold}><Play size={16} />{t("quizSeeFold")}</button>
      )}
      <button className="btn btn-primary" onClick={() => next(kind, mode)} data-testid="quiz-next"><ArrowRight size={16} />{t("quizNext")}</button>
    </>
  ) : null;

  return (
    <Modal title={t("quiz")} icon={CircleHelp} onClose={onClose} size="xl" testId="quiz" footer={footer}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented value={kind} onChange={(v) => { setKind(v); next(v, mode); }} label={t("quizType")} options={[
            { value: "random", label: t("quizMixed") },
            { value: "net2cube", label: t("quizNet2Cube") },
            { value: "cube2net", label: t("quizCube2Net") },
          ]} />
          <Segmented value={mode} onChange={(v) => { setMode(v); next(kind, v); }} label={t("quizAsk")} options={[
            { value: "random", label: t("quizMixed") },
            { value: "correct", label: t("quizAskRight") },
            { value: "different", label: t("quizAskDifferent") },
          ]} />
          <span className="ml-auto text-sm text-muted tabular-nums" data-testid="quiz-score">{t("quizScore")} {score.right}/{score.total}</span>
        </div>

        {loading || !q ? (
          <div className="h-[50dvh] grid place-items-center text-muted">
            {loading ? <Loader2 className="animate-spin text-mint" size={28} /> : <p>{t("quizFailed")}</p>}
          </div>
        ) : (
          <div className="space-y-4 anim-rise" key={q.id}>
            {practice && <p className="hint rounded-xl bg-spark/10 border border-spark/40 px-3 py-2">{t("quizPractice")}</p>}
            <p className="font-display font-semibold text-lg leading-snug" data-testid="quiz-prompt" data-kind={q.kind} data-mode={q.mode}>{prompt}</p>
            <div className="flex justify-center gap-3 rounded-2xl bg-white border border-line p-3" data-testid="quiz-question">
              {q.question.map((url, i) => (
                <figure key={i} className="text-center">
                  <CanvasView canvas={url} className={`${q.kind === "net2cube" ? "h-[26dvh] aspect-[6/5]" : "h-[22dvh] aspect-square"} block`} />
                  {q.question.length > 1 && <figcaption className="text-xs text-[#557177]">{t("quizView")} {i + 1}</figcaption>}
                </figure>
              ))}
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {q.choices.map((c, i) => {
                const shown = picked != null;
                const isAnswer = i === q.answer;
                const ring = !shown ? "border-line hover:border-mint" : isAnswer ? "border-good ring-2 ring-good" : i === picked ? "border-bad ring-2 ring-bad" : "border-line opacity-80";
                return (
                  <button
                    key={i}
                    onClick={() => answer(i)}
                    disabled={shown}
                    data-testid="quiz-choice"
                    data-right={c.right}
                    className={`relative rounded-2xl border bg-white p-1.5 text-left transition-all ${ring} ${!shown ? "hover:-translate-y-0.5" : ""}`}
                  >
                    <span className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-[#0e3238] text-white text-xs font-bold grid place-items-center">{i + 1}</span>
                    <CanvasView canvas={c.url} className="w-full h-auto aspect-square block" label={`${t("quizChoice")} ${i + 1}`} />
                    <span className={`block mt-1 text-center text-[11px] font-semibold rounded-lg py-0.5 ${shown ? (c.right ? "bg-good/15 text-good" : "bg-bad/15 text-bad") : "invisible"}`}>
                      {c.right ? t("quizFolds") : t("quizNoFold")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
