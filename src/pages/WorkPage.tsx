/* The machines of the plugins and their jobs: the plugins and machines, the queue and history of the generic jobs, the live events of the server, the places of the tools in the
 * changer, and the notifications. What the role does not allow is not offered; the server decides in the end. */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useApp, usePolled } from "../context";
import { Badge, Card, DangerButton, Empty, Field, Progress, StartButton } from "../components/ui";
import { AtcEditor, problemText } from "../components/AtcEditor";
import { useFeed, useServices } from "../services/context";
import { EMPTY_FEED, affects, eventLine, feedReducer, matchesFeed } from "../services/events";
import type { FeedEvent } from "../services/events";
import { whenText } from "../services/format";
import { problemOfDetail } from "../services/atc";
import { ApiError } from "../api";
import {
  NEEDS_CONFIRMATION,
  WORK_TONE,
  countByState,
  filterQueue,
  isFinished,
  jobActions,
  markedRead,
  notificationFromEvent,
  orderQueue,
  parseRequest,
  parseSettings,
  percentOf,
  requestKinds,
  requestTemplate,
  unreadCount,
  validMachineId,
  withNotification,
} from "../services/work";
import type { JobAction } from "../services/work";
import { WORK_STATES } from "../services/types";
import type { WorkJob, WorkJobSummary, WorkNotification, WorkState } from "../services/types";
import type { TextKey } from "../i18n";

const TABS = ["queue", "machines", "live", "atc", "notices"] as const;
const TAB_TEXT: Record<(typeof TABS)[number], TextKey> = { queue: "nav_jobs", machines: "ov_machines", live: "nav_live", atc: "atc_title", notices: "wk_tab_notices" };
const STATE_TEXT: Record<WorkState, TextKey> = { queued: "wk_st_queued", running: "job_running", paused: "wk_st_paused", done: "job_done", failed: "job_failed", cancelled: "job_cancelled" };
type Tab = (typeof TABS)[number];
const FAMILIES = ["", "job", "machine", "project", "catalog", "notification"];

export function WorkPage({ route }: { route: string }) {
  const { t, err, refreshS } = useApp();
  const sv = useServices();
  const [tab, setTab] = useState<Tab>((TABS as readonly string[]).includes(route) ? (route as Tab) : "queue");
  const [request, setRequest] = useState(requestTemplate(["demo"]));
  const [notes, setNotes] = useState<WorkNotification[] | null>(null);
  const machines = usePolled(() => sv.work.machines(), refreshS);
  const plugins = usePolled(() => sv.work.plugins(), 0);
  const jobs = usePolled(() => sv.work.jobs({ limit: 200 }), refreshS);
  const canView = sv.allowed("machines.view");

  // the stream: a change of a job or a machine asks for the lists again (a moment later, once for a burst), a notification joins the list at once
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [feed, feedDispatch] = useReducer(feedReducer, EMPTY_FEED);
  const reloadAll = useCallback(() => {
    machines.reload();
    jobs.reload();
  }, [machines, jobs]);
  const reloadRef = useRef(reloadAll);
  reloadRef.current = reloadAll;
  const feedState = useFeed({
    onEvent: (e: FeedEvent) => {
      feedDispatch({ type: "event", event: e });
      if (e.kind === "notification") {
        const n = notificationFromEvent(e.data);
        if (n) setNotes((cur) => withNotification(cur ?? [], n));
      }
      if (affects(e, "jobs") || affects(e, "machines")) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => reloadRef.current(), 300);
      }
    },
    onResync: () => {
      feedDispatch({ type: "resync" });
      reloadRef.current();
    },
  });
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    let alive = true;
    sv.work.notifications().then(
      (n) => alive && setNotes(n),
      () => alive && setNotes([]),
    );
    return () => {
      alive = false;
    };
  }, [sv]);

  if (!canView) return <Card title={t("nav_work")}>{<Empty>{t("svc_not_allowed")}</Empty>}</Card>;
  const unread = notes ? unreadCount(notes) : 0;
  const counts = jobs.data ? countByState(jobs.data.items) : null;

  return (
    <div className="stack">
      <div className="tiles">
        <div className="tile">
          <small>{t("ov_machines")}</small>
          <strong>{machines.data?.length ?? "-"}</strong>
        </div>
        <div className="tile run">
          <small>{t("job_running")}</small>
          <strong>{counts ? counts.running + counts.paused : "-"}</strong>
        </div>
        <div className="tile wait">
          <small>{t("wk_st_queued")}</small>
          <strong>{counts?.queued ?? "-"}</strong>
        </div>
        <div className="tile bad">
          <small>{t("job_failed")}</small>
          <strong>{counts?.failed ?? "-"}</strong>
        </div>
      </div>
      <div className="tabs" role="tablist" aria-label={t("nav_work")}>
        {TABS.map((x) => (
          <button key={x} role="tab" id={`tab-${x}`} aria-selected={tab === x} aria-controls={`panel-${x}`} className={tab === x ? "active" : ""} onClick={() => setTab(x)}>
            {t(TAB_TEXT[x])}
            {x === "notices" && unread > 0 ? ` (${unread})` : ""}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="stack">
        {(machines.error != null || jobs.error != null) && <p className="error">{err(machines.error ?? jobs.error)}</p>}
        {tab === "queue" && (
          <>
            <QueueCard jobs={jobs.data?.items ?? null} machines={machines.data ?? []} reload={reloadAll} />
            {sv.allowed("jobs.prepare") && <NewJob machines={machines.data ?? []} plugins={plugins.data ?? []} request={request} setRequest={setRequest} reload={reloadAll} />}
          </>
        )}
        {tab === "machines" && <MachinesCard machines={machines.data ?? null} plugins={plugins.data ?? null} reload={reloadAll} />}
        {tab === "live" && <LiveCard events={feed.events} total={feed.total} resyncs={feed.resyncs} status={feedState} machines={(machines.data ?? []).map((m) => m.id)} onClear={() => feedDispatch({ type: "clear" })} />}
        {tab === "atc" && <AtcEditor request={request} onRequest={(x) => { setRequest(x); setTab("queue"); }} canEdit={sv.allowed("jobs.prepare")} />}
        {tab === "notices" && <NoticesCard notes={notes} setNotes={setNotes} />}
      </div>
    </div>
  );
}

// ---- the queue

function QueueCard({ jobs, machines, reload }: { jobs: WorkJobSummary[] | null; machines: { id: string; capabilities?: Record<string, unknown> }[]; reload: () => void }) {
  const { t, err, say, session } = useApp();
  const sv = useServices();
  const [machine, setMachine] = useState("");
  const [state, setState] = useState("");
  const [query, setQuery] = useState("");
  const [mine, setMine] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [detail, setDetail] = useState<WorkJob | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => orderQueue(filterQueue(jobs ?? [], { machine, state, query, mine, me: session.name })), [jobs, machine, state, query, mine, session.name]);

  useEffect(() => {
    setDetail(null);
    if (!open) return;
    let alive = true;
    sv.work.job(open).then(
      (j) => alive && setDetail(j),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [sv, open, jobs]);

  const act = async (job: WorkJobSummary, a: JobAction) => {
    setBusy(true);
    try {
      if (a === "start") await sv.work.start(job.id);
      else if (a === "pause") await sv.work.pause(job.id);
      else if (a === "resume") await sv.work.resume(job.id);
      else if (a === "cancel") await sv.work.cancel(job.id);
      else await sv.work.remove(job.id);
      reload();
    } catch (e) {
      say(err(e), "error");
      reload();
    } finally {
      setBusy(false);
    }
  };

  const caps = (id: string) => machines.find((m) => m.id === id)?.capabilities;

  return (
    <Card title={t("nav_jobs")} actions={<button onClick={reload}>{t("act_refresh")}</button>}>
      <div className="filters">
        <label>
          {t("jobs_machine")}
          <select value={machine} onChange={(e) => setMachine(e.target.value)}>
            <option value="">{t("jobs_all")}</option>
            {machines.map((m) => (
              <option key={m.id} value={m.id}>
                {m.id}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("jobs_state")}
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="">{t("jobs_all")}</option>
            <option value="active">{t("wk_active")}</option>
            {WORK_STATES.map((s) => (
              <option key={s} value={s}>
                {t(STATE_TEXT[s])}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("jobs_search")}
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          {t("pj_mine")}
        </label>
      </div>
      {jobs === null ? (
        <p className="muted">{t("svc_loading")}</p>
      ) : list.length === 0 ? (
        <Empty>{t("jobs_empty")}</Empty>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>{t("jobs_name")}</th>
              <th>{t("jobs_machine")}</th>
              <th>{t("jobs_state")}</th>
              <th>{t("jobs_progress")}</th>
              <th>{t("jobs_by")}</th>
              <th>{t("job_created")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map((j) => {
              const actions = jobActions(j, sv.who, caps(j.machine));
              return (
                <tr key={j.id}>
                  <td>
                    <button type="button" className="link" aria-expanded={open === j.id} onClick={() => setOpen(open === j.id ? null : j.id)}>
                      <strong>{j.name || j.id.slice(0, 10)}</strong>
                    </button>
                    {open === j.id && (
                      <div className="job-history">
                        <small className="muted">
                          <code>{j.id}</code> · {j.plugin} {j.app ? `· ${j.app}` : ""}
                        </small>
                        {j.message && <p>{j.message}</p>}
                        {detail?.history && detail.history.length > 0 ? (
                          <ol>
                            {detail.history.map((h, i) => (
                              <li key={i}>
                                {whenText(h.at)} · {t(STATE_TEXT[h.state])} · {h.by}
                                {h.note ? ` · ${h.note}` : ""}
                              </li>
                            ))}
                          </ol>
                        ) : (
                          <p className="muted">{t("svc_loading")}</p>
                        )}
                      </div>
                    )}
                  </td>
                  <td>{j.machine}</td>
                  <td>
                    <Badge tone={WORK_TONE[j.state]}>{t(STATE_TEXT[j.state])}</Badge>
                    {j.state === "queued" && j.position ? <small className="muted"> #{j.position}</small> : null}
                  </td>
                  <td className="cell-bar">
                    <Progress percent={percentOf(j)} tone={j.state === "failed" ? "bad" : j.state === "done" ? "ok" : j.state === "paused" ? "wait" : "run"} />
                    <small className="muted">{percentOf(j)}%</small>
                  </td>
                  <td>{j.owner ?? j.by ?? ""}</td>
                  <td>{whenText(j.created)}</td>
                  <td>
                    <div className="row-actions">
                      {actions.map((a) =>
                        a === "start" ? (
                          <StartButton key={a} label={t("act_start")} disabled={busy} onConfirm={() => void act(j, a)} />
                        ) : NEEDS_CONFIRMATION.includes(a) ? (
                          <DangerButton key={a} label={a === "remove" ? t("act_delete") : t("act_stop")} disabled={busy} onConfirm={() => void act(j, a)} />
                        ) : (
                          <button key={a} disabled={busy} onClick={() => void act(j, a)}>
                            {a === "pause" ? t("act_pause") : t("act_resume")}
                          </button>
                        ),
                      )}
                      {isFinished(j.state) && actions.length === 0 ? <span className="muted">-</span> : null}
                    </div>
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

function NewJob({
  machines,
  plugins,
  request,
  setRequest,
  reload,
}: {
  machines: { id: string; name: string; plugin: string; capabilities?: Record<string, unknown> }[];
  plugins: { kind: string; title: string }[];
  request: string;
  setRequest: (s: string) => void;
  reload: () => void;
}) {
  const { t, err, say } = useApp();
  const sv = useServices();
  const [machine, setMachine] = useState("");
  const [name, setName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parsed = parseRequest(request);

  const pick = (id: string) => {
    setMachine(id);
    const m = machines.find((x) => x.id === id);
    if (m) setRequest(requestTemplate(requestKinds(m.capabilities)));
  };

  const prepare = async () => {
    if (!parsed.ok || !machine) return;
    setBusy(true);
    setProblem(null);
    try {
      await sv.work.create({ machine, request: parsed.value, name: name.trim() || undefined });
      say(t("up_state_done"), "ok");
      setName("");
      reload();
    } catch (e) {
      // the refusal of a rack that does not fit says which place and which tool
      if (e instanceof ApiError && e.code === "bad_rack") {
        const p = problemOfDetail(e.detail);
        if (p) {
          const [key, vars] = problemText(p);
          setProblem(t(key, vars));
          return;
        }
      }
      say(err(e), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("wk_new_job")}>
      {machines.length === 0 ? (
        <Empty>{t("mach_empty")}</Empty>
      ) : (
        <>
          <div className="form-grid">
            <Field label={t("jobs_machine")}>
              <select value={machine} onChange={(e) => pick(e.target.value)}>
                <option value="">-</option>
                {machines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id} ({plugins.find((p) => p.kind === m.plugin)?.title ?? m.plugin})
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("prep_name")}>
              <input value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Field label={t("wk_request")}>
            <textarea rows={8} value={request} aria-invalid={!parsed.ok} onChange={(e) => setRequest(e.target.value)} spellCheck={false} />
          </Field>
          {!parsed.ok && <p className="error">{t("wk_request_syntax")}</p>}
          {problem && (
            <p className="error" role="alert">
              {problem}
            </p>
          )}
          <div className="form-actions">
            <button className="primary" disabled={busy || !parsed.ok || !machine} onClick={() => void prepare()}>
              {t("wk_prepare")}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

// ---- plugins and machines

function MachinesCard({ machines, plugins, reload }: { machines: { id: string; name: string; plugin: string; state: string; job?: string | null }[] | null; plugins: { kind: string; title: string; manages_machines: boolean; capabilities: Record<string, unknown> }[] | null; reload: () => void }) {
  const { t, err, say } = useApp();
  const sv = useServices();
  const admin = sv.allowed("machines.manage");
  const [id, setId] = useState("");
  const [nm, setNm] = useState("");
  const [plugin, setPlugin] = useState("");
  const [settings, setSettings] = useState("");
  const [busy, setBusy] = useState(false);
  const own = (plugins ?? []).filter((p) => p.manages_machines);
  const parsedSettings = parseSettings(settings);
  const ok = admin && validMachineId(id) && nm.trim() !== "" && (plugin || own[0]?.kind) && parsedSettings !== null;

  const add = async () => {
    setBusy(true);
    try {
      await sv.work.addMachine({ id, name: nm.trim(), plugin: plugin || own[0].kind, settings: parsedSettings ?? {} });
      say(t("mach_saved"), "ok");
      setId("");
      setNm("");
      setSettings("");
      reload();
    } catch (e) {
      say(err(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const stop = async (job: string) => {
    try {
      await sv.work.cancel(job);
      reload();
    } catch (e) {
      say(err(e), "error");
    }
  };
  const remove = async (machine: string) => {
    try {
      await sv.work.deleteMachine(machine);
      say(t("mach_deleted"), "ok");
      reload();
    } catch (e) {
      say(err(e), "error");
    }
  };

  return (
    <>
      <Card title={t("ov_machines")} actions={<button onClick={reload}>{t("act_refresh")}</button>}>
        {machines === null ? (
          <p className="muted">{t("svc_loading")}</p>
        ) : machines.length === 0 ? (
          <Empty>{t("mach_empty")}</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("mach_name")}</th>
                <th>{t("wk_plugin")}</th>
                <th>{t("jobs_state")}</th>
                <th>{t("nav_job")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {machines.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name || m.id}</strong> <small className="muted">{m.id}</small>
                  </td>
                  <td>{plugins?.find((p) => p.kind === m.plugin)?.title ?? m.plugin}</td>
                  <td>
                    <Badge tone={m.state === "busy" ? "run" : "ok"}>{m.state === "busy" ? t("st_busy") : t("st_idle")}</Badge>
                  </td>
                  <td>{m.job ? <code>{m.job.slice(0, 12)}</code> : "-"}</td>
                  <td>
                    <div className="row-actions">
                      {m.job && sv.allowed("jobs.cancel") && <DangerButton label={t("act_stop")} onConfirm={() => void stop(m.job!)} />}
                      {admin && plugins?.find((p) => p.kind === m.plugin)?.manages_machines && <DangerButton label={t("act_delete")} disabled={m.state === "busy"} onConfirm={() => void remove(m.id)} />}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title={t("wk_plugins")}>
        {plugins === null ? (
          <p className="muted">{t("svc_loading")}</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("wk_plugin")}</th>
                <th>{t("jobs_kind")}</th>
              </tr>
            </thead>
            <tbody>
              {plugins.map((p) => (
                <tr key={p.kind}>
                  <td>
                    <strong>{p.title}</strong> <small className="muted">{p.kind}</small>
                  </td>
                  <td>{requestKinds(p.capabilities).join(", ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      {admin && own.length > 0 && (
        <Card title={t("wk_add_machine")}>
          <div className="form-grid">
            <Field label={t("mach_id")} hint={t("mach_id_hint")}>
              <input value={id} aria-invalid={id !== "" && !validMachineId(id)} onChange={(e) => setId(e.target.value)} />
            </Field>
            <Field label={t("mach_name")}>
              <input value={nm} maxLength={80} onChange={(e) => setNm(e.target.value)} />
            </Field>
            <Field label={t("wk_plugin")}>
              <select value={plugin || own[0].kind} onChange={(e) => setPlugin(e.target.value)}>
                {own.map((p) => (
                  <option key={p.kind} value={p.kind}>
                    {p.title}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label={t("wk_settings")} hint={parsedSettings === null ? t("wk_request_syntax") : undefined}>
            <textarea rows={3} value={settings} aria-invalid={parsedSettings === null} onChange={(e) => setSettings(e.target.value)} spellCheck={false} />
          </Field>
          <div className="form-actions">
            <button className="primary" disabled={busy || !ok} onClick={() => void add()}>
              {t("act_create")}
            </button>
          </div>
        </Card>
      )}
    </>
  );
}

// ---- the live events

function LiveCard({ events, total, resyncs, status, machines, onClear }: { events: FeedEvent[]; total: number; resyncs: number; status: { status: string; attempt: number; retry: () => void }; machines: string[]; onClear: () => void }) {
  const { t } = useApp();
  const [machine, setMachine] = useState("");
  const [job, setJob] = useState("");
  const [family, setFamily] = useState("");
  const shown = useMemo(() => events.filter((e) => matchesFeed(e, { machine, job: job.trim(), family })), [events, machine, job, family]);
  return (
    <Card
      title={t("nav_live")}
      actions={
        <>
          <span role="status">
            <Badge tone={status.status === "live" ? "ok" : status.status === "failed" ? "bad" : "wait"}>{t(status.status === "live" ? "wk_feed_live" : status.status === "reconnecting" ? "wk_feed_reconnecting" : status.status === "failed" || status.status === "stopped" ? "wk_feed_failed" : "wk_feed_connecting", { n: status.attempt })}</Badge>
          </span>
          {(status.status === "failed" || status.status === "stopped") && <button onClick={status.retry}>{t("act_retry")}</button>}
          <button onClick={onClear}>{t("live_clear")}</button>
        </>
      }
    >
      <div className="filters">
        <label>
          {t("jobs_machine")}
          <select value={machine} onChange={(e) => setMachine(e.target.value)}>
            <option value="">{t("jobs_all")}</option>
            {machines.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("nav_job")}
          <input value={job} onChange={(e) => setJob(e.target.value)} />
        </label>
        <label>
          {t("jobs_kind")}
          <select value={family} onChange={(e) => setFamily(e.target.value)}>
            {FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f === "" ? t("jobs_all") : f}
              </option>
            ))}
          </select>
        </label>
      </div>
      {shown.length === 0 ? (
        <Empty>{t("live_empty")}</Empty>
      ) : (
        <ul className="events" aria-live="off">
          {shown.slice(0, 150).map((e) => (
            <li key={`${e.id}-${e.kind}`}>
              <time>#{e.id}</time> {eventLine(e)}
            </li>
          ))}
        </ul>
      )}
      <p className="hint" aria-hidden="true">
        {total} · {resyncs}
      </p>
    </Card>
  );
}

// ---- notifications

function NoticesCard({ notes, setNotes }: { notes: WorkNotification[] | null; setNotes: (n: WorkNotification[]) => void }) {
  const { t, err, say } = useApp();
  const sv = useServices();
  const mark = async (ids: number[] | "all") => {
    try {
      await sv.work.markRead(ids === "all" ? { all: true } : { ids });
      setNotes(markedRead(notes ?? [], ids));
    } catch (e) {
      say(err(e), "error");
    }
  };
  const label = (n: WorkNotification): string => {
    const key = `wk_note_${n.kind.replace(/\./g, "_")}`;
    return n.kind === "job.waiting" || n.kind === "job.done" || n.kind === "job.failed" ? t(key as TextKey) : n.title;
  };
  return (
    <Card title={t("wk_tab_notices")} actions={<button disabled={!notes || unreadCount(notes) === 0} onClick={() => void mark("all")}>{t("wk_mark_all")}</button>}>
      {notes === null ? (
        <p className="muted">{t("svc_loading")}</p>
      ) : notes.length === 0 ? (
        <Empty>{t("wk_no_notes")}</Empty>
      ) : (
        <ul className="notices">
          {notes.map((n) => (
            <li key={n.id} className={n.read ? "read" : "unread"}>
              <span aria-hidden="true">{n.read ? "○" : "●"}</span>{" "}
              <strong>{label(n)}</strong>
              {typeof n.data?.name === "string" && n.data.name ? ` · ${n.data.name}` : ""}
              {typeof n.data?.machine === "string" ? ` · ${n.data.machine}` : ""} <small className="muted">{whenText(n.at)}</small>
              {!n.read && (
                <button className="link" onClick={() => void mark([n.id])}>
                  {t("wk_mark")}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
