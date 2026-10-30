/* One machine on its own page: what it is doing, the jobs that wait for it (and how long they will take together), the last ones it finished, and the ways to
 * give it work. */
import { useApp, usePolled } from "../context";
import { Badge, Card, Empty, Progress } from "../components/ui";
import { machineQueue } from "../jobtools";
import { atLeast, duration, jobPercent } from "../model";
import { JOB_TONE, stateKey } from "./Monitor";

const MACHINE_TONE = { idle: "ok", busy: "run", waiting: "wait" } as const;

export function MachinePage({ id }: { id: string }) {
  const { api, session, t, err, say, refreshS } = useApp();
  const fleet = usePolled(() => api.fleet(), refreshS || 3, [id]);
  const jobs = usePolled(() => api.jobs({ machine: id }), refreshS || 3, [id]);
  const m = fleet.data?.machines.find((x) => x.id === id);
  if (fleet.error != null && !fleet.data) return <p className="error">{err(fleet.error)}</p>;
  if (!fleet.data) return <Empty>…</Empty>;
  if (!m) {
    return (
      <div className="stack">
        <Empty>{t("err_not_found")}</Empty>
        <a href="#/fleet">{t("nav_fleet")}</a>
      </div>
    );
  }
  const q = machineQueue(jobs.data ?? [], id);
  const tone = MACHINE_TONE[m.state];
  const operator = atLeast(session.role, "operator");
  const start = async (jobId: string) => {
    try {
      await api.startJob(jobId);
      jobs.reload();
      fleet.reload();
    } catch (e) {
      say(err(e), "error");
    }
  };
  return (
    <div className="stack">
      <Card
        title={m.name}
        wide
        actions={
          <>
            <a className="button" href="#/fleet">
              {t("nav_fleet")}
            </a>
            {operator && (
              <a className="button primary" href={`#/prepare/${encodeURIComponent(id)}`}>
                {t("nav_prepare")}
              </a>
            )}
          </>
        }
      >
        <dl className="facts">
          <dt>{t("jobs_state")}</dt>
          <dd>
            <Badge tone={tone}>{t(m.state === "idle" ? "st_idle" : m.state === "busy" ? "st_busy" : "st_waiting")}</Badge>
          </dd>
          <dt>{t("mach_id")}</dt>
          <dd>{m.id}</dd>
          <dt>{t("mach_model")}</dt>
          <dd>{m.model}</dd>
          <dt>{t("mach_station")}</dt>
          <dd>{m.station || "-"}</dd>
          <dt>{t("mach_connection")}</dt>
          <dd>{m.connection}</dd>
          <dt>{t("mach_queue")}</dt>
          <dd>{q.ready.length > 0 ? `${q.ready.length} · ${duration(q.readySeconds)}` : "-"}</dd>
        </dl>
      </Card>

      <Card title={t("mach_now")} wide>
        {q.active ? (
          <div className="machine-row">
            <span className={`dot ${tone}`} />
            <div className="machine-name">
              <a href={`#/job/${q.active.id}`}>
                <strong>{q.active.name}</strong>
              </a>
              <small>{t(stateKey(q.active.state))}</small>
            </div>
            <Progress percent={jobPercent(q.active)} tone={q.active.state === "waiting_operator" ? "wait" : "run"} />
            <span className="pct">{jobPercent(q.active)} %</span>
          </div>
        ) : (
          <Empty>{t("mach_nothing")}</Empty>
        )}
      </Card>

      <Card title={t("mach_ready")} wide>
        {q.ready.length === 0 ? (
          <Empty>{t("mach_no_ready")}</Empty>
        ) : (
          q.ready.map((j) => (
            <div key={j.id} className="machine-row">
              <span className="dot" />
              <div className="machine-name">
                <a href={`#/job/${j.id}`}>
                  <strong>{j.name}</strong>
                </a>
                <small>
                  {j.by} · {duration(j.estimate_s)}
                </small>
              </div>
              {operator && m.state === "idle" && (
                <button className="primary" onClick={() => void start(j.id)}>
                  {t("act_start")}
                </button>
              )}
            </div>
          ))
        )}
      </Card>

      <Card title={t("mach_recent")} wide>
        {q.recent.length === 0 ? (
          <Empty>{t("jobs_empty")}</Empty>
        ) : (
          <table className="table">
            <tbody>
              {q.recent.map((j) => (
                <tr key={j.id}>
                  <td>
                    <a href={`#/job/${j.id}`}>
                      <strong>{j.name}</strong>
                    </a>
                  </td>
                  <td>
                    <Badge tone={JOB_TONE[j.state]}>{t(stateKey(j.state))}</Badge>
                  </td>
                  <td>{j.by}</td>
                  <td>{j.finished ? new Date(j.finished * 1000).toLocaleString() : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
