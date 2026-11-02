/* The summary of a job and the button that starts it: before a job starts on a machine, the person sees what it does, how long it takes, how far each axis
 * goes (the dry run of the exact plan) and what looks wrong in the file, and starts it from there. GPL-3.0-or-later. */
import { useEffect, useState } from "react";
import { useApp } from "../context";
import { confirmStartOn, duration, reachLine, startSummary } from "../model";
import type { JobView } from "../types";
import { StartButton } from "./ui";

function storage(): Pick<Storage, "getItem"> | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The facts of a job, its dry run and its warnings. Used before the start and in the preview of the Prepare page. */
export function SummaryFacts({ view, compact }: { view: JobView; compact?: boolean }) {
  const { t } = useApp();
  const s = startSummary(view);
  return (
    <div className="start-summary">
      {!compact && (
        <dl className="facts">
          <dt>{view.name || view.kind}</dt>
          <dd>{t("sum_count", { n: s.count, tools: s.tools })}</dd>
          {s.sizeMm && (
            <>
              <dt>{t("sum_size")}</dt>
              <dd>{`${s.sizeMm[0]} x ${s.sizeMm[1]} mm`}</dd>
            </>
          )}
          {s.seconds !== null && (
            <>
              <dt>{t("sum_time")}</dt>
              <dd>{duration(s.seconds)}</dd>
            </>
          )}
        </dl>
      )}
      {s.reach && (
        <p className={s.outOfCourse ? "warn" : "hint"}>
          <strong>{s.outOfCourse ? t("sum_dry_bad") : t("sum_dry_ok")}</strong>
          <br />
          {t("sum_reach")}: <code>{reachLine(s.reach)}</code>
        </p>
      )}
      {s.warnings.length > 0 && (
        <div className="spindle-warning" role="alert">
          <ul>
            {s.warnings.map((w, i) => (
              <li key={i}>{t(w.key, w.vars)}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * The button that starts a job. With the summary on (the preference, on by default) a touch opens the summary of the job and its Start button is the
 * confirmation; with it off the button asks "Sure?" as it always did.
 */
export function StartJobButton({ jobId, label, onStart, disabled }: { jobId: string; label: string; onStart: () => void; disabled?: boolean }) {
  const { api, t, err, say } = useApp();
  const [view, setView] = useState<JobView | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    api.job(jobId).then(
      (j) => {
        if (alive) {
          setView(j.view);
          setLoading(false);
        }
      },
      (e) => {
        if (alive) {
          say(err(e), "error");
          setOpen(false);
        }
      },
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId]);
  if (!confirmStartOn(storage())) return <StartButton label={label} onConfirm={onStart} disabled={disabled} />;
  return (
    <>
      <button type="button" className="primary" disabled={disabled} onClick={() => setOpen(true)}>
        {label}
      </button>
      {open && (
        <div className="sum-backdrop" role="dialog" aria-modal="true" aria-label={t("sum_title")}>
          <div className="sum-box">
            <h3>{t("sum_title")}</h3>
            {loading ? <p className="hint">{t("sum_loading")}</p> : view && <SummaryFacts view={view} />}
            <div className="sum-actions">
              <button type="button" onClick={() => setOpen(false)}>
                {t("sum_cancel")}
              </button>
              <button
                type="button"
                className="primary"
                disabled={loading}
                onClick={() => {
                  setOpen(false);
                  onStart();
                }}
              >
                {t("sum_start")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
