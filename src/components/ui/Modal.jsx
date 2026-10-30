import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useLang } from "../../contexts/LanguageContext";

/**
 * Shared dialog shell: dimmed backdrop, Esc / backdrop click to close,
 * focus moves into the dialog and back to where it was on close.
 */
export default function Modal({ title, icon: Icon, subtitle, onClose, children, footer, size = "md", z = "z-[100]", testId }) {
  const { t } = useLang();
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  const downOnBackdrop = useRef(false);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  // runs once per opening: focus in, Esc to close, focus back out
  useEffect(() => {
    const before = document.activeElement;
    ref.current?.focus({ preventScroll: true });
    const onKey = (e) => { if (e.key === "Escape") closeRef.current?.(); };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (before instanceof HTMLElement) before.focus({ preventScroll: true });
    };
  }, []);

  const width = { sm: "max-w-sm", md: "max-w-xl", lg: "max-w-4xl", xl: "max-w-5xl" }[size];

  return (
    <div
      className={`fixed inset-0 ${z} flex items-center justify-center p-4 bg-[#03161a]/45 backdrop-blur-[3px] anim-fade`}
      // close only when the press both starts and ends on the backdrop (a drag that slips
      // off the dialog, e.g. while drawing, must not close it)
      onPointerDown={(e) => { downOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (downOnBackdrop.current && e.target === e.currentTarget) onClose?.(); downOnBackdrop.current = false; }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        tabIndex={-1}
        data-testid={testId}
        className={`w-full ${width} max-h-[90dvh] flex flex-col rounded-3xl bg-surface text-ink border border-line shadow-2xl anim-rise outline-none`}
      >
        <header className="flex items-start gap-3 px-6 pt-5 pb-4">
          {Icon && (
            <span className="mt-0.5 grid place-items-center w-9 h-9 rounded-xl bg-mint/15 text-brand-ink shrink-0">
              <Icon size={18} />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-display font-semibold text-lg leading-tight">{title}</h2>
            {subtitle && <p className="hint mt-1">{subtitle}</p>}
          </div>
          <button data-close onClick={onClose} aria-label={t("close")} className="btn btn-ghost btn-icon -mr-2 -mt-1">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto scroll-area px-6 pb-6">{children}</div>
        {footer && <footer className="px-6 py-4 border-t border-line flex flex-wrap gap-2 justify-end">{footer}</footer>}
      </div>
    </div>
  );
}

/** On/off switch with a visible label. The real checkbox covers the switch, so taps land on it. */
export function Toggle({ checked, onChange, label, icon: Icon, testId }) {
  return (
    <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
      <span className="flex items-center gap-3 text-sm font-medium">
        {Icon && <Icon size={18} className="text-muted" />}
        {label}
      </span>
      <span className="relative inline-flex w-11 h-6 shrink-0">
        <input
          type="checkbox"
          data-testid={testId}
          className="peer absolute inset-0 z-10 m-0 opacity-0 cursor-pointer"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="w-11 h-6 rounded-full bg-line peer-checked:bg-mint transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-mint peer-focus-visible:outline-offset-2" />
        <span className="absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

/** Small segmented control. options: [{ value, label }] */
export function Segmented({ value, onChange, options, label, size = "sm", full = false }) {
  return (
    <div role="radiogroup" aria-label={label} className={`${full ? "grid grid-flow-col auto-cols-fr w-full" : "inline-flex"} p-1 rounded-xl bg-surface-2 border border-line`}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`${size === "sm" ? "px-3 h-8 text-xs" : "px-4 h-9 text-sm"} rounded-lg font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            value === o.value ? "bg-surface text-ink shadow-sm" : "text-muted hover:text-ink"
          }`}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}
