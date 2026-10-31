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
      className="absolute top-20 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-sm bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
          <CircleHelp size={14} />
          {t("quiz")}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500" data-testid="quiz-score">{t("quizScore")} {score.correct}/{score.total}</span>
          <button onClick={onClose} aria-label={t("quizClose")} className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X size={16} />
          </button>
        </div>
      </div>

      {notice && <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("quizNoLabels")}</p>}

      <p className="text-base font-semibold text-slate-800 dark:text-slate-100" data-testid="quiz-question" data-face={question.faceId}>
        {t("quizQuestion")} <span className="inline-flex items-center justify-center min-w-8 px-2 py-0.5 rounded-md bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300 font-bold">{question.label}</span> ?
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
              className={`h-11 rounded-lg font-bold text-lg border transition-colors ${
                isAnswer
                  ? "bg-emerald-500 border-emerald-500 text-white"
                  : isWrongPick
                    ? "bg-rose-500 border-rose-500 text-white"
                    : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:border-indigo-400 disabled:opacity-60"
              }`}
            >
              {c.label}
            </button>
          );
        })}
      </div>

      {answered && (
        <div aria-live="polite" data-testid="quiz-result" data-correct={correct} className={`flex items-center gap-2 text-sm font-medium ${correct ? "text-emerald-600" : "text-rose-600"}`}>
          {correct ? <Check size={16} /> : <X size={16} />}
          {correct ? t("quizCorrect") : `${t("quizWrong")} ${answerLabel}`}
        </div>
      )}

      {answered && (
        <div className="flex gap-2">
          <button onClick={onNext} data-testid="quiz-next" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white">
            <ArrowRight size={16} />
            {t("quizNext")}
          </button>
          <button onClick={onNewNet} data-testid="quiz-new-net" className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
            <Shuffle size={16} />
            {t("quizNewNet")}
          </button>
        </div>
      )}
    </div>
  );
}
