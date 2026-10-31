import { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useLang } from "../../contexts/LanguageContext";
import { Mail, Lock, Loader2, AlertCircle, UserRound } from "lucide-react";
import Modal from "../ui/Modal";

export default function AuthModal({ isOpen, onClose }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const { t } = useLang();

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!email || !password) return setError(t("authFillAll"));
    if (password.length < 6) return setError(t("authShortPassword"));
    try {
      setLoading(true);
      if (isLogin) await login(email, password);
      else await register(email, password);
      onClose();
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") setError(t("authEmailUsed"));
      else if (err.code === "auth/invalid-credential") setError(t("authWrong"));
      else setError(`${t("authFailed")} (${err.code || err.message})`);
    } finally {
      setLoading(false);
    }
  };

  const field = (Icon, props) => (
    <div className="relative">
      <Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
      <input {...props} className="field pl-9 h-11" />
    </div>
  );

  return (
    <Modal title={isLogin ? t("authSignInTitle") : t("authSignUpTitle")} subtitle={t("authWhy")} icon={UserRound} onClose={onClose} size="sm" testId="auth">
      {error && (
        <div role="alert" className="mb-4 p-3 rounded-xl bg-bad/10 text-bad text-sm flex items-start gap-2">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{t("email")}</span>
          {field(Mail, { type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com" })}
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{t("password")}</span>
          {field(Lock, { type: "password", autoComplete: isLogin ? "current-password" : "new-password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "••••••••" })}
        </label>
        <button type="submit" disabled={loading} className="btn btn-primary w-full h-11 mt-2">
          {loading && <Loader2 size={16} className="animate-spin" />}
          {isLogin ? t("signIn") : t("signUp")}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-muted">
        {isLogin ? t("authNoAccount") : t("authHaveAccount")}
        <button onClick={() => { setIsLogin(!isLogin); setError(""); }} className="ml-1.5 font-semibold text-brand-ink hover:underline">
          {isLogin ? t("signUp") : t("signIn")}
        </button>
      </p>
    </Modal>
  );
}
