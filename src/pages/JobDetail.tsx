/* One job on its own page: the plan with the holes already drilled, how far it has got, who did what and when, the tools, and the buttons that fit its state. */
import { useApp, usePolled } from "../context";
import { Badge, Card, DangerButton, Empty, Progress, StartButton } from "../components/ui";
import { PlanDownload, PlanView } from "../components/PlanView";
import { took } from "../jobtools";
import { canGoOn, duration, isActive, jobActions, jobKindKey, jobPercent, pauseKey, resumeLine, spindleFindingKey } from "../model";
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
  const from = resumeLine(job);
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
              <StartButton label={t("act_start")} onConfirm={() => void act(() => api.startJob(job.id))} />
            )}
            {a.confirm && (
              <button className="primary" onClick={() => void act(() => api.confirmJob(job.id))}>
                {t("act_confirm")}
              </button>
            )}
            {a.pause && <button onClick={() => void act(() => api.pauseJob(job.id))}>{t("act_pause")}</button>}
            {a.resume && (
              <button className="primary" onClick={() => void act(() => api.resumeJob(job.id))}>
                {t("act_resume")}
              </button>
            )}
            {canGoOn(job, session.role) && (
              <button
                className="primary"
                onClick={() =>
                  void act(async () => {
                    const next = await api.resumeFrom(job.id);
                    say(t("job_resumed_new"), "ok");
                    window.location.hash = `#/job/${encodeURIComponent(next.id)}`;
                  })
                }
              >
                {t("act_go_on")}
              </button>
            )}
            {a.cancel && <button onClick={() => void act(() => (isActive(job) ? api.stopMachine(job.machine) : api.cancelJob(job.id)))}>{isActive(job) ? t("act_stop") : t("act_cancel")}</button>}
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
        {job.pause && <p className="warn">{t("job_waits_for", { what: t(pauseKey(job.pause), { tool: job.pause.tool ?? "" }) })}</p>}
        {canGoOn(job, session.role) && <p className="hint">{from != null ? t("job_resume_help", { line: from }) : t("job_go_on_help")}</p>}
        {job.resumed_from && (
          <p className="hint">
            {t("job_goes_on_from")} <a href={`#/job/${encodeURIComponent(job.resumed_from)}`}>{job.resumed_from}</a>
          </p>
        )}
        {(job.view?.spindle_warnings?.length ?? 0) > 0 && (
          <div className="spindle-warning" role="alert">
            <strong>{t("spindle_warn_title")}</strong>
            <ul>
              {job.view?.spindle_warnings?.map((w, i) => (
                <li key={i}>{t(spindleFindingKey(w.code), { tool: w.tool, value: w.value, limit: w.limit })}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="plan-grid">
          {job.view && job.kind === "gcode" ? (
            <div>
              <p className="hint">{t("job_gcode_noplan")}</p>
            </div>
          ) : job.view ? (
            <div>
              <PlanView view={job.view} itemsDone={isActive(job) || job.state === "done" ? job.items_done : undefined} label={job.name} />
              <PlanDownload name={job.name} />
            </div>
          ) : (
            <Empty>{t("job_no_view")}</Empty>
          )}
          <div>
            <dl className="facts">
              <dt>{t("jobs_machine")}</dt>
              <dd>
                <a href={`#/machine/${encodeURIComponent(job.machine)}`}>{job.machine}</a>
              </dd>
              <dt>{t("jobs_by")}</dt>
              <dd>{job.by}</dd>
              <dt>{t("jobs_kind")}</dt>
              <dd>{t(jobKindKey(job.kind))}</dd>
              {job.kind === "gcode" ? (
                <>
                  <dt>{t("job_line")}</dt>
                  <dd>{job.line ?? 0}</dd>
                  {job.view?.bounds_mm && (
                    <>
                      <dt>{t("prep_size")}</dt>
                      <dd>{`${(job.view.bounds_mm[2] - job.view.bounds_mm[0]).toFixed(1)} x ${(job.view.bounds_mm[3] - job.view.bounds_mm[1]).toFixed(1)} mm`}</dd>
                    </>
                  )}
                </>
              ) : (
                <>
                  <dt>{t("job_holes")}</dt>
                  <dd>
                    {job.holes_done} / {job.holes_total}
                  </dd>
                </>
              )}
              {job.view && ((job.view.skipped ?? 0) > 0 || (job.view.skipped_tools?.length ?? 0) > 0) && (
                <>
                  <dt>{t("job_left_out")}</dt>
                  <dd>{t("job_left_out_line", { n: job.view.skipped ?? 0, tools: (job.view.skipped_tools ?? []).join(", ") || "-" })}</dd>
                </>
              )}
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
