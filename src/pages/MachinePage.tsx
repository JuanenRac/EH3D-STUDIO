/* One machine on its own page: what it is doing, the jobs that wait for it (and how long they will take together), the last ones it finished, and the ways to
 * give it work. */
import { useEffect, useState } from "react";
import { useApp, usePolled } from "../context";
import { Badge, Card, Empty, Progress, StartButton } from "../components/ui";
import { ApiError } from "../api";
import type { HeadMeasure, SpindleGuard, SpindleId } from "../types";
import { LIGHT_TONES } from "../types";
import { SPINDLE_IDS } from "../types";
import { machineQueue } from "../jobtools";
import { atLeast, duration, jobPercent, spindleNameKey } from "../model";
import { JOB_TONE, stateKey } from "./Monitor";
import type { TextKey } from "../i18n";

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

      <SpindleCard id={id} admin={atLeast(session.role, "admin")} />

      <HeadCard id={id} operator={operator} />

      <HeadLightCard id={id} operator={operator} />

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
              {operator && m.state === "idle" && <StartButton label={t("act_start")} onConfirm={() => void start(j.id)} />}
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

/** The spindle the machine carries and what happens to a job that asks for more than it gives. Everybody reads it; an administrator changes it. */
function SpindleCard({ id, admin }: { id: string; admin: boolean }) {
  const { api, t, err, say } = useApp();
  const { data, error, reload } = usePolled(() => api.spindle(id), 0, [id]);
  const change = async (c: { spindle?: SpindleId | ""; guard?: SpindleGuard }) => {
    try {
      await api.setSpindle(id, c);
      say(t("spindle_saved"), "ok");
      reload();
    } catch (e) {
      say(err(e), "error");
    }
  };
  return (
    <Card title={t("spindle_title")} wide>
      {error != null && !data && <p className="error">{err(error)}</p>}
      {data && (
        <div className="plan-grid">
          <dl className="facts">
            <dt>{t("spindle_which")}</dt>
            <dd>
              {admin ? (
                <select value={data.spindle} onChange={(e) => void change({ spindle: e.target.value as SpindleId | "" })}>
                  <option value="">{t("spindle_unset")}</option>
                  {SPINDLE_IDS.map((s) => (
                    <option key={s} value={s}>
                      {t(spindleNameKey(s))}
                    </option>
                  ))}
                </select>
              ) : (
                t(spindleNameKey(data.spindle))
              )}
            </dd>
            <dt>{t("spindle_guard")}</dt>
            <dd>
              {admin ? (
                <select value={data.guard} onChange={(e) => void change({ guard: e.target.value as SpindleGuard })}>
                  <option value="reject">{t("spindle_guard_reject")}</option>
                  <option value="warn">{t("spindle_guard_warn")}</option>
                </select>
              ) : (
                t(data.guard === "warn" ? "spindle_guard_warn" : "spindle_guard_reject")
              )}
            </dd>
            {data.active && (
              <>
                <dt>{t("spindle_limits")}</dt>
                <dd>
                  {t("spindle_limits_line", {
                    min: data.active.min_rpm,
                    max: data.active.max_rpm,
                    xy: data.active.max_xy_mm_min,
                    z: data.active.max_z_mm_min,
                    bit: data.active.max_bit_mm,
                  })}
                </dd>
                <dt>{t("spindle_node_rpm")}</dt>
                <dd>{data.node_max_rpm}</dd>
              </>
            )}
          </dl>
        </div>
      )}
    </Card>
  );
}

/** The ring of LEDs of the head and the last quality check of the work. Not shown when the machine has no node of the head. */
function HeadLightCard({ id, operator }: { id: string; operator: boolean }) {
  const { api, t, err, say, refreshS } = useApp();
  const light = usePolled(() => api.headLight(id), refreshS || 5, [id]);
  const check = usePolled(() => api.headInspection(id), 0, [id]);
  const [level, setLevel] = useState<number | null>(null);
  if (light.error instanceof ApiError && (light.error.code === "no_head" || light.error.code === "head_unreachable" || light.error.code === "head_refused")) return null;
  const change = async (c: { on?: boolean; level?: number; tone?: string }) => {
    try {
      await api.setHeadLight(id, c);
      light.reload();
    } catch (e) {
      say(err(e), "error");
    }
  };
  const l = light.data;
  const shown = level ?? l?.level ?? 0;
  const noCheck = check.error instanceof ApiError && check.error.code === "no_inspection";
  const fails = check.data?.findings?.filter((f) => f.fails).length ?? 0;
  return (
    <Card title={t("head_light")} wide>
      {light.error != null && !l && <p className="error">{err(light.error)}</p>}
      {l && (
        <dl className="facts">
          <dt>{t("head_light")}</dt>
          <dd>
            <Badge tone={l.on ? "ok" : "dim"}>{l.on ? t("head_light_on") : t("head_light_off")}</Badge>
            {operator && (
              <button onClick={() => void change({ on: !l.on })}>{l.on ? t("head_light_off") : t("head_light_on")}</button>
            )}
          </dd>
          <dt>{t("head_light_level")}</dt>
          <dd>
            {operator ? (
              <input
                type="range"
                min={0}
                max={l.max_level ?? 100}
                value={shown}
                onChange={(e) => setLevel(Number(e.target.value))}
                onMouseUp={() => {
                  if (level != null) void change({ level });
                  setLevel(null);
                }}
                onTouchEnd={() => {
                  if (level != null) void change({ level });
                  setLevel(null);
                }}
                onKeyUp={() => {
                  if (level != null) void change({ level });
                  setLevel(null);
                }}
              />
            ) : null}{" "}
            {shown} %
          </dd>
          <dt>{t("head_light_tone")}</dt>
          <dd>
            {operator ? (
              <select value={l.tone ?? "white"} onChange={(e) => void change({ tone: e.target.value })}>
                {LIGHT_TONES.map((tn) => (
                  <option key={tn} value={tn}>
                    {t(`tone_${tn}` as TextKey)}
                  </option>
                ))}
              </select>
            ) : (
              (l.tone ?? "-")
            )}
          </dd>
        </dl>
      )}
      <h4>{t("head_inspect")}</h4>
      {noCheck && <p className="hint">{t("head_inspect_none")}</p>}
      {check.error != null && !noCheck && !check.data && <p className="error">{err(check.error)}</p>}
      {check.data && (
        <p>
          <Badge tone={check.data.verdict === "ok" ? "ok" : check.data.verdict === "not_ok" ? "bad" : "dim"}>{t(`verdict_${check.data.verdict}` as TextKey)}</Badge>{" "}
          {t("head_inspect_findings", { n: check.data.findings?.length ?? 0, fails })}
        </p>
      )}
    </Card>
  );
}

/** The picture of the camera: it asks for a ticket first, because the address of a picture cannot carry the token of the session. */
function CameraPicture({ machine }: { machine: string }) {
  const { api, t } = useApp();
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api.ticket().then(
      ({ ticket }) => alive && setSrc(api.headStreamUrl(machine, ticket)),
      () => alive && setSrc(null),
    );
    return () => {
      alive = false;
    };
  }, [api, machine]);
  return src ? <img className="head-camera" src={src} alt={t("head_title")} /> : null;
}

/** The node of the drill head of this machine, through the server: what it says, its camera and a measure of the table. Not shown when the machine has no node. */
function HeadCard({ id, operator }: { id: string; operator: boolean }) {
  const { api, t, err, say, refreshS } = useApp();
  const { data, error } = usePolled(() => api.headStatus(id), refreshS || 5, [id]);
  const [camera, setCamera] = useState(false);
  const [measure, setMeasure] = useState<HeadMeasure | null>(null);
  const [busy, setBusy] = useState(false);
  if (error instanceof ApiError && error.code === "no_head") return null;
  const measureNow = async () => {
    setBusy(true);
    try {
      setMeasure(await api.headMeasure(id));
    } catch (e) {
      setMeasure(null);
      say(err(e), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card
      title={t("head_title")}
      wide
      actions={
        <>
          {data?.camera && <button onClick={() => setCamera((c) => !c)}>{camera ? t("head_hide_camera") : t("head_show_camera")}</button>}
          {operator && data?.laser && (
            <button disabled={busy} onClick={() => void measureNow()}>
              {t("head_measure")}
            </button>
          )}
        </>
      }
    >
      {error != null && !data && <p className="error">{err(error)}</p>}
      {data && (
        <div className="plan-grid">
          <dl className="facts">
            <dt>{t("head_node")}</dt>
            <dd>
              {data.node} {data.version}
              {data.camera_model ? ` · ${data.camera_model}` : ""}
            </dd>
            <dt>{t("head_speed")}</dt>
            <dd>{data.rpm_sensor ? `${Math.round(data.rpm)} rpm` : "-"}</dd>
            <dt>{t("head_temp")}</dt>
            <dd>
              {data.temp_c == null ? "-" : `${data.temp_c.toFixed(1)} °C`} <Badge tone={data.heat === "hot" ? "bad" : data.heat === "warm" ? "wait" : data.heat === "ok" ? "ok" : "dim"}>{t(`heat_${data.heat}` as TextKey)}</Badge>
            </dd>
            <dt>{t("head_protect")}</dt>
            <dd>
              <Badge tone={data.protect_open ? "bad" : "ok"}>{data.protect_open ? t("head_protect_open") : t("head_protect_closed")}</Badge>
            </dd>
            {measure && (
              <>
                <dt>{t("head_measure")}</dt>
                <dd>{measure.ok ? `${measure.distance_mm.toFixed(3)} mm ± ${measure.sigma_mm.toFixed(3)} (${measure.used}/${measure.asked})` : `${t("head_refused_why")}: ${measure.why ?? "?"}`}</dd>
              </>
            )}
          </dl>
          {camera && data.camera && <CameraPicture machine={id} />}
        </div>
      )}
    </Card>
  );
}
