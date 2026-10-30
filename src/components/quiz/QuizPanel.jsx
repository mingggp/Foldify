import { CircleHelp, Check, X, ArrowRight, Shuffle } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";

/** Floating "guess before folding" card. All logic lives in App (see lib/quiz.js). */
export default function QuizPanel({ quiz, onAnswer, onNext, onNewNet, onClose }) {
  const { t } = useLang();
  if (!quiz?.question) return null;
  const { question, picked, score, notice } = quiz;
  const answered = picked != null;
  const correct = answered && picked === question.answerFaceId;
  const answerLabel = question.choices.find((c) => c.faceId === question.answerFaceId)?.label;

  return (
    <div
      role="dialog"
      aria-label={t("quiz")}
      data-testid="quiz-panel"
      className="absolute top-20 left-1/2 -translate-x-1/2 lg:left-4 lg:translate-x-0 lg:max-w-[22rem] z-20 w-[calc(100%-1.5rem)] max-w-sm glass rounded-3xl p-4 space-y-3 anim-rise"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-display font-semibold text-brand-ink">
          <CircleHelp size={16} />
          {t("quiz")}
        </span>
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted tabular-nums" data-testid="quiz-score">{t("quizScore")} {score.correct}/{score.total}</span>
          <button onClick={onClose} aria-label={t("quizClose")} className="btn btn-ghost btn-icon -mr-1">
            <X size={17} />
          </button>
        </div>
      </div>

      {notice && <p className="hint">{t("quizNoLabels")}</p>}

      <p className="text-base font-semibold leading-snug" data-testid="quiz-question" data-face={question.faceId}>
        {t("quizQuestion")}{" "}
        <span key={question.faceId} className="anim-pop inline-grid place-items-center min-w-9 h-9 px-2 rounded-xl bg-spark/25 text-ink font-display font-bold text-lg align-middle border border-spark">
          {question.label}
        </span>{" "}
        ?
      </p>

      <div className="grid grid-cols-5 gap-2">
        {question.choices.map((c) => {
          const isAnswer = answered && c.faceId === question.answerFaceId;
          const isWrongPick = answered && c.faceId === picked && !isAnswer;
          return (
            <button
              key={c.faceId}
              data-testid="quiz-choice"
              data-face={c.faceId}
              disabled={answered}
              onClick={() => onAnswer(c.faceId)}
              className={`h-12 rounded-xl font-display font-bold text-lg border transition-all ${
                isAnswer
                  ? "bg-good border-good text-white anim-pop"
                  : isWrongPick
                    ? "bg-bad border-bad text-white"
                    : "bg-surface border-line hover:border-mint hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {answered && (
        <div aria-live="polite" data-testid="quiz-result" data-correct={correct} className={`flex items-center gap-2 text-sm font-semibold anim-rise ${correct ? "text-good" : "text-bad"}`}>
          {correct ? <Check size={17} /> : <X size={17} />}
          {correct ? t("quizCorrect") : `${t("quizWrong")} ${answerLabel}`}
        </div>
      )}

      {answered && (
        <div className="grid grid-cols-2 gap-2">
          <button onClick={onNext} data-testid="quiz-next" className="btn btn-primary">
            <ArrowRight size={16} />
            {t("quizNext")}
          </button>
          <button onClick={onNewNet} data-testid="quiz-new-net" className="btn btn-soft">
            <Shuffle size={16} />
            {t("quizNewNet")}
          </button>
        </div>
      )}
    </div>
  );
}
