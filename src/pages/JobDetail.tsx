/* One job on its own page: the plan with the holes already drilled, how far it has got, who did what and when, the tools, and the buttons that fit its state. */
import { useApp, usePolled } from "../context";
import { Badge, Card, DangerButton, Empty, Progress } from "../components/ui";
import { PlanView } from "../components/PlanView";
import { took } from "../jobtools";
import { duration, isActive, jobActions, jobPercent } from "../model";
import { ToolTable } from "./Prepare";
import { JOB_TONE, stateKey } from "./Monitor";

function when(seconds: number | null): string {
  return seconds == null ? "-" : new Date(seconds * 1000).toLocaleString();
}

export function JobPage({ id }: { id: string }) {
  const { api, session, t, err, say, refreshS } = useApp();
  const { data: job, error, reload } = usePolled(() => api.job(id), refreshS || 3, [id]);
  const act = async (what: () => Promise<unknown>, after?: () => void) => {
    try {
      await what();
      if (after) after();
      else reload();
    } catch (e) {
      say(err(e), "error");
    }
  };
  if (error != null && !job) {
    return (
      <div className="stack">
        <p className="error">{err(error)}</p>
        <a href="#/jobs">{t("nav_jobs")}</a>
      </div>
    );
  }
  if (!job) return <Empty>…</Empty>;
  const a = jobActions(job, session.role);
  const pct = jobPercent(job);
  const tone = job.state === "failed" ? "bad" : job.state === "waiting_operator" ? "wait" : job.state === "done" ? "ok" : "run";
  return (
    <div className="stack">
      <Card
        title={job.name}
        wide
        actions={
          <>
            <a className="button" href="#/jobs">
              {t("nav_jobs")}
            </a>
            {a.start && (
              <button className="primary" onClick={() => void act(() => api.startJob(job.id))}>
                {t("act_start")}
              </button>
            )}
            {a.confirm && (
              <button className="primary" onClick={() => void act(() => api.confirmJob(job.id))}>
                {t("act_confirm")}
              </button>
            )}
            {a.cancel && <button onClick={() => void act(() => api.cancelJob(job.id))}>{isActive(job) ? t("act_stop") : t("act_cancel")}</button>}
            {a.remove && <DangerButton label={t("act_delete")} onConfirm={() => void act(() => api.deleteJob(job.id), () => (window.location.hash = "#/jobs"))} />}
          </>
        }
      >
        <div className="job-head">
          <Badge tone={JOB_TONE[job.state]}>{t(stateKey(job.state))}</Badge>
          <Progress percent={pct} tone={tone} />
          <strong>{pct} %</strong>
        </div>
        {job.message && <p className="warn">{job.message}</p>}
        {job.pause && (
          <p className="warn">
            {t("job_waits_for", { what: job.pause.kind + (job.pause.tool != null ? ` T${job.pause.tool}` : "") })}
          </p>
        )}
        <div className="plan-grid">
          {job.view ? <PlanView view={job.view} itemsDone={isActive(job) || job.state === "done" ? job.items_done : undefined} label={job.name} /> : <Empty>{t("job_no_view")}</Empty>}
          <div>
            <dl className="facts">
              <dt>{t("jobs_machine")}</dt>
              <dd>
                <a href="#/fleet">{job.machine}</a>
              </dd>
              <dt>{t("jobs_by")}</dt>
              <dd>{job.by}</dd>
              <dt>{t("jobs_drill")}/{t("jobs_route")}</dt>
              <dd>{job.kind === "drill" ? t("jobs_drill") : t("jobs_route")}</dd>
              <dt>{t("job_holes")}</dt>
              <dd>
                {job.holes_done} / {job.holes_total}
              </dd>
              <dt>{t("job_items")}</dt>
              <dd>
                {job.items_done} / {job.items_total}
              </dd>
              <dt>{t("jobs_estimate")}</dt>
              <dd>{duration(job.estimate_s)}</dd>
              <dt>{t("job_created")}</dt>
              <dd>{when(job.created)}</dd>
              <dt>{t("job_started")}</dt>
              <dd>{when(job.started)}</dd>
              <dt>{t("job_finished")}</dt>
              <dd>{when(job.finished)}</dd>
              <dt>{t("job_took")}</dt>
              <dd>{duration(took(job))}</dd>
            </dl>
            {job.view && <ToolTable view={job.view} />}
          </div>
        </div>
      </Card>
    </div>
  );
}
