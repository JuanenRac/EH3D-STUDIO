/* The four pages of the group Monitor: the overview, the machines by station, the jobs and the live events. */
import { useEffect, useRef, useState } from "react";
import { useApp, usePolled } from "../context";
import { Badge, Card, DangerButton, Empty, Progress, StartButton } from "../components/ui";
import { atLeast, countJobs, duration, groupFleet, isActive, jobActions, jobKindKey, jobPercent, pauseKey } from "../model";
import { JOB_ORDERS, finishedIds, jobsCsv, matchesQuery, sortJobs, totals, waitingJobs } from "../jobtools";
import type { JobOrder } from "../jobtools";
import type { FleetMachine, JobState } from "../types";
import { JOB_STATES } from "../types";
import type { TextKey } from "../i18n";

const MACHINE_TONE = { idle: "ok", busy: "run", waiting: "wait" } as const;
export const JOB_TONE: Record<JobState, "ok" | "run" | "wait" | "bad" | "dim"> = {
  ready: "dim",
  connecting: "run",
  running: "run",
  waiting_operator: "wait",
  done: "ok",
  cancelled: "dim",
  failed: "bad",
};

export function stateKey(s: JobState): TextKey {
  return `job_${s}` as TextKey;
}

export function Overview() {
  const { api, t, err, refreshS } = useApp();
  const fleet = usePolled(() => api.fleet(), refreshS);
  const jobs = usePolled(() => api.jobs(), refreshS);
  const health = usePolled(() => api.health(), 0);
  const f = fleet.data?.summary;
  const c = jobs.data ? countJobs(jobs.data) : null;
  const tile = (label: string, value: number | string, tone?: string) => (
    <div className={`tile ${tone ?? ""}`}>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
  return (
    <div className="grid">
      {fleet.error != null && <p className="error">{err(fleet.error)}</p>}
      <NeedsYou jobs={jobs.data ?? []} onDone={jobs.reload} />
      <Card title={t("ov_fleet")}>
        <div className="tiles">
          {tile(t("ov_machines"), f?.machines ?? "-")}
          {tile(t("ov_free"), f?.idle ?? "-", "ok")}
          {tile(t("ov_running"), f?.busy ?? "-", "run")}
          {tile(t("ov_waiting"), f?.waiting ?? "-", "wait")}
          {tile(t("ov_stations"), f?.stations ?? "-")}
        </div>
      </Card>
      <Card title={t("ov_jobs")}>
        <div className="tiles">
          {tile(t("job_ready"), c?.ready ?? "-")}
          {tile(t("ov_active"), c ? c.connecting + c.running + c.waiting_operator : "-", "run")}
          {tile(t("job_done"), c?.done ?? "-", "ok")}
          {tile(t("job_failed"), c?.failed ?? "-", c && c.failed > 0 ? "bad" : "")}
        </div>
      </Card>
      {jobs.data && (
        <Card title={t("ov_history")}>
          {(() => {
            const s = totals(jobs.data);
            return (
              <div className="tiles">
                {tile(t("job_done"), s.done, "ok")}
                {tile(t("job_failed"), s.failed, s.failed > 0 ? "bad" : "")}
                {tile(t("job_holes"), s.holes)}
                {tile(t("ov_time"), duration(s.seconds))}
              </div>
            );
          })()}
        </Card>
      )}
      <Card title={t("ov_server")}>
        <dl className="facts">
          <dt>{t("ov_version")}</dt>
          <dd>{health.data ? `${health.data.name} ${health.data.version}` : "-"}</dd>
          <dt>{t("ov_signed")}</dt>
          <dd>{api.token ? "✓" : "-"}</dd>
        </dl>
      </Card>
    </div>
  );
}

/** The jobs that wait for the operator, with the button that answers them, at the top of the overview where nobody can miss them. */
function NeedsYou({ jobs, onDone }: { jobs: import("../types").JobSummary[]; onDone: () => void }) {
  const { api, session, t, err, say } = useApp();
  const waiting = waitingJobs(jobs);
  if (waiting.length === 0) return null;
  return (
    <Card title={t("ov_needs_you", { n: waiting.length })} wide>
      {waiting.map((j) => (
        <div key={j.id} className="machine-row">
          <span className="dot wait" />
          <div className="machine-name">
            <a href={`#/job/${j.id}`}>
              <strong>{j.name}</strong>
            </a>
            <small>
              {j.machine} · {j.pause ? t(pauseKey(j.pause), { tool: j.pause.tool ?? "" }) : ""}
            </small>
          </div>
          {jobActions(j, session.role).resume && (
            <button className="primary" onClick={() => void api.resumeJob(j.id).then(onDone, (e) => say(err(e), "error"))}>
              {t("act_resume")}
            </button>
          )}
          {jobActions(j, session.role).confirm && (
            <button
              className="primary"
              onClick={() =>
                void api.confirmJob(j.id).then(onDone, (e) => say(err(e), "error"))
              }
            >
              {t("act_confirm")}
            </button>
          )}
        </div>
      ))}
    </Card>
  );
}

function MachineRow({ m }: { m: FleetMachine }) {
  const { t } = useApp();
  const tone = MACHINE_TONE[m.state];
  return (
    <div className="machine-row">
      <span className={`dot ${tone}`} />
      <div className="machine-name">
        <a href={`#/machine/${encodeURIComponent(m.id)}`}>
          <strong>{m.name}</strong>
        </a>
        <small>
          {m.id} · {m.model} · {m.connection}
        </small>
      </div>
      <Badge tone={tone}>{t(m.state === "idle" ? "st_idle" : m.state === "busy" ? "st_busy" : "st_waiting")}</Badge>
      <div className="machine-job">
        {m.job ? (
          <>
            <a href={`#/job/${m.job.id}`}>{m.job.name}</a>
            <Progress percent={m.job.percent} tone={m.state === "waiting" ? "wait" : "run"} />
          </>
        ) : m.ready > 0 ? (
          <small>{t("fleet_ready", { n: m.ready })}</small>
        ) : null}
      </div>
      {m.job && <span className="pct">{m.job.percent} %</span>}
    </div>
  );
}

export function FleetPage() {
  const { api, t, err, refreshS } = useApp();
  const { data, error } = usePolled(() => api.fleet(), refreshS);
  if (error != null && !data) return <p className="error">{err(error)}</p>;
  if (!data) return <Empty>…</Empty>;
  const groups = groupFleet(data);
  if (groups.length === 0) return <Empty>{t("fleet_empty")}</Empty>;
  return (
    <div className="stack">
      {groups.map((g) => (
        <Card key={g.station || "none"} title={g.station === "" ? t("fleet_nostation") : g.station.toUpperCase()} wide>
          {g.machines.map((m) => (
            <MachineRow key={m.id} m={m} />
          ))}
        </Card>
      ))}
    </div>
  );
}

export function JobsPage() {
  const { api, session, t, err, say, refreshS } = useApp();
  const [machine, setMachine] = useState("");
  const [state, setState] = useState("");
  const [query, setQuery] = useState("");
  const [order, setOrder] = useState<JobOrder>("newest");
  const machines = usePolled(() => api.machines(), 0);
  const { data, error, reload } = usePolled(() => api.jobs({ machine, state }), refreshS, [machine, state]);
  const act = async (what: () => Promise<unknown>) => {
    try {
      await what();
      reload();
    } catch (e) {
      say(err(e), "error");
    }
  };
  const shown = data ? sortJobs(data.filter((j) => matchesQuery(j, query)), order) : [];
  const clearFinished = async () => {
    const ids = finishedIds(shown);
    try {
      for (const id of ids) await api.deleteJob(id);
      say(t("jobs_cleared", { n: ids.length }), "ok");
    } catch (e) {
      say(err(e), "error");
    }
    reload();
  };
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob([jobsCsv(shown)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "eh3d-jobs.csv";
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Card
      title={t("nav_jobs")}
      wide
      actions={
        <>
          {atLeast(session.role, "operator") && (
            <a className="button primary" href="#/prepare">
              {t("nav_prepare")}
            </a>
          )}
          <button disabled={shown.length === 0} onClick={exportCsv}>
            {t("jobs_csv")}
          </button>
          {atLeast(session.role, "operator") && finishedIds(shown).length > 0 && <DangerButton label={t("jobs_clear", { n: finishedIds(shown).length })} onConfirm={() => void clearFinished()} />}
        </>
      }
    >
      <div className="filters">
        <label>
          {t("jobs_search")}
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          {t("jobs_order")}
          <select value={order} onChange={(e) => setOrder(e.target.value as JobOrder)}>
            {JOB_ORDERS.map((o) => (
              <option key={o} value={o}>
                {t(`order_${o}` as TextKey)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("jobs_machine")}
          <select value={machine} onChange={(e) => setMachine(e.target.value)}>
            <option value="">{t("jobs_all")}</option>
            {(machines.data ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("jobs_state")}
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">{t("jobs_all")}</option>
            {JOB_STATES.map((s) => (
              <option key={s} value={s}>
                {t(stateKey(s))}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error != null && <p className="error">{err(error)}</p>}
      {data && shown.length === 0 && <Empty>{t("jobs_empty")}</Empty>}
      {data && shown.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th>{t("jobs_name")}</th>
              <th>{t("jobs_machine")}</th>
              <th>{t("jobs_state")}</th>
              <th>{t("jobs_progress")}</th>
              <th>{t("jobs_by")}</th>
              <th>{t("jobs_estimate")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((j) => {
              const a = jobActions(j, session.role);
              const pct = jobPercent(j);
              return (
                <tr key={j.id}>
                  <td>
                    <a href={`#/job/${j.id}`}>
                      <strong>{j.name}</strong>
                    </a>
                    <small>{t(jobKindKey(j.kind))}</small>
                    {j.message && <small className="warn">{j.message}</small>}
                  </td>
                  <td>{j.machine}</td>
                  <td>
                    <Badge tone={JOB_TONE[j.state]}>{t(stateKey(j.state))}</Badge>
                  </td>
                  <td className="cell-bar">
                    <Progress percent={pct} tone={j.state === "failed" ? "bad" : j.state === "waiting_operator" ? "wait" : j.state === "done" ? "ok" : "run"} />
                    <small>{pct} %</small>
                  </td>
                  <td>{j.by}</td>
                  <td>{duration(j.estimate_s)}</td>
                  <td className="row-actions">
                    {a.start && <StartButton label={t("act_start")} onConfirm={() => void act(() => api.startJob(j.id))} />}
                    {a.confirm && <button onClick={() => void act(() => api.confirmJob(j.id))}>{t("act_confirm")}</button>}
                    {a.pause && <button onClick={() => void act(() => api.pauseJob(j.id))}>{t("act_pause")}</button>}
                    {a.resume && <button onClick={() => void act(() => api.resumeJob(j.id))}>{t("act_resume")}</button>}
                    {a.cancel && <button onClick={() => void act(() => (isActive(j) ? api.stopMachine(j.machine) : api.cancelJob(j.id)))}>{isActive(j) ? t("act_stop") : t("act_cancel")}</button>}
                    {a.remove && (
                      <button className="danger" onClick={() => void act(() => api.deleteJob(j.id))}>
                        {t("act_delete")}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

interface LiveEvent {
  at: number;
  text: string;
}

/** One line for an event of the server: `job` events say which job and where it is, the others are shown as they come. */
export function describeEvent(raw: string): string {
  try {
    const v = JSON.parse(raw) as { type?: string; job?: { name?: string; state?: string; machine?: string; items_done?: number; items_total?: number }; id?: string; jobs?: unknown[] };
    if (v.type === "hello") return `hello · ${v.jobs?.length ?? 0} jobs`;
    if (v.type === "job" && v.job) return `${v.job.name ?? "?"} · ${v.job.machine ?? "?"} · ${v.job.state ?? "?"} · ${v.job.items_done ?? 0}/${v.job.items_total ?? 0}`;
    if (v.type === "job_removed") return `removed · ${v.id ?? "?"}`;
    return raw.length > 200 ? raw.slice(0, 200) + "…" : raw;
  } catch {
    return raw.slice(0, 200);
  }
}

export function LivePage() {
  const { api, t } = useApp();
  const [lines, setLines] = useState<LiveEvent[]>([]);
  const [open, setOpen] = useState(false);
  const retry = useRef(0);
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const again = () => {
      setOpen(false);
      if (!closed) {
        retry.current = Math.min(retry.current + 1, 6);
        timer = setTimeout(connect, 1000 * 2 ** retry.current);
      }
    };
    const connect = () => {
      // each connection asks for its own ticket: it is good for one use
      api.ticket().then(
        ({ ticket }) => {
          if (closed) return;
          ws = new WebSocket(api.eventsUrl(window.location, ticket));
          ws.onopen = () => {
            setOpen(true);
            retry.current = 0;
          };
          ws.onmessage = (m) => setLines((old) => [{ at: Date.now(), text: describeEvent(String(m.data)) }, ...old].slice(0, 200));
          ws.onclose = again;
        },
        again,
      );
    };
    connect();
    return () => {
      closed = true;
      if (timer) clearTimeout(timer);
      ws?.close();
    };
  }, [api]);
  return (
    <Card
      title={t("nav_live")}
      wide
      actions={
        <>
          <Badge tone={open ? "ok" : "bad"}>{open ? t("live_on") : t("live_off")}</Badge>
          <button onClick={() => setLines([])}>{t("live_clear")}</button>
        </>
      }
    >
      {lines.length === 0 ? (
        <Empty>{t("live_empty")}</Empty>
      ) : (
        <ul className="events">
          {lines.map((l, i) => (
            <li key={i}>
              <time>{new Date(l.at).toLocaleTimeString()}</time> {l.text}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
