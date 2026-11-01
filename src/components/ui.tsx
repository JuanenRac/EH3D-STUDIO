/* The few parts every page is built from: a card with the cut corner, a labelled field, a progress bar, a state badge, a button that asks once more before it deletes. */
import { useState } from "react";
import type { ReactNode } from "react";
import { useApp } from "../context";
import { twoSteps } from "../jobtools";

export function Card({ title, children, actions, wide }: { title?: string; children: ReactNode; actions?: ReactNode; wide?: boolean }) {
  return (
    <section className={`card${wide ? " wide" : ""}`}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h3>{title}</h3>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <small className="hint">{hint}</small>}
    </label>
  );
}

export function Progress({ percent, tone }: { percent: number; tone?: "run" | "wait" | "ok" | "bad" }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className={`bar ${tone ?? "run"}`} role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${p}%` }} />
    </div>
  );
}

export function Badge({ tone, children }: { tone: "ok" | "run" | "wait" | "bad" | "dim"; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

/** A delete button that needs a second click (the second click is the confirmation; leaving the button cancels it). */
export function DangerButton({ label, onConfirm, disabled }: { label: string; onConfirm: () => void; disabled?: boolean }) {
  const { t } = useApp();
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`danger${armed ? " armed" : ""}`}
      disabled={disabled}
      onBlur={() => setArmed(false)}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? t("sure") : label}
    </button>
  );
}

/**
 * The button that starts a job: the first touch asks ("Sure?"), the second one starts it, and leaving the button cancels. The same care that the apps take from the Prepare
 * screen: a touch by mistake (a glove, a dirty screen) must not set the machine going.
 */
export function StartButton({ label, onConfirm, disabled }: { label: string; onConfirm: () => void; disabled?: boolean }) {
  const { t } = useApp();
  const [armed, setArmed] = useState(false);
  return (
    <button
      type="button"
      className={`primary${armed ? " armed" : ""}`}
      disabled={disabled}
      onBlur={() => setArmed(false)}
      onClick={() => {
        const next = twoSteps(armed);
        setArmed(next.armed);
        if (next.fire) onConfirm();
      }}
    >
      {armed ? t("sure") : label}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
