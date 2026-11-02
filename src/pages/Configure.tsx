/* The group Configure: the machines of the server (each with how to reach it, its stations and its configuration files), the people and the tokens of the programs,
 * and the reference of the settings of the server itself. */
import { useState } from "react";
import { useApp, usePolled } from "../context";
import { Badge, Card, DangerButton, Empty, Field } from "../components/ui";
import { cfgKeys, tokenDays, tokenState, connectionBody, dollarSwitchShown, connectionKey, DEFAULT_BAUD, emptyMachine, machineProblems, parseReleaseNotes, splitStep, studioReplaced, toInput, updatable, updatesBusy, validName, validPassword } from "../model";
import type { MachineProblem } from "../model";
import { copyId, machineExport, machineImport } from "../jobtools";
import { copyText } from "../clipboard";
import type { ConnectionKind, MachineInput, Role } from "../types";
import { CONNECTION_KINDS, ROLES } from "../types";
import type { TextKey } from "../i18n";

const MODELS = ["ccd-mtc", "ccd-atc", "ccd2-mtc", "ccd2-atc", "ccd-premium-mtc", "ccd-premium-atc"];

export function MachinesPage() {
  const { api, session, t, err, say } = useApp();
  const { data, error, reload } = usePolled(() => api.machines(), 0);
  const [form, setForm] = useState<{ isNew: boolean; m: MachineInput } | null>(null);
  const [saving, setSaving] = useState(false);

  const problems: MachineProblem[] = form ? machineProblems(form.m) : [];
  const set = (patch: Partial<MachineInput>) => setForm((f) => (f ? { ...f, m: { ...f.m, ...patch } } : f));
  const setConn = (patch: Partial<MachineInput["connection"]>) => setForm((f) => (f ? { ...f, m: { ...f.m, connection: { ...f.m.connection, ...patch } } } : f));

  const save = async () => {
    if (!form || problems.length) return;
    setSaving(true);
    try {
      const body: MachineInput = { ...form.m, connection: connectionBody(form.m.connection) };
      // the switch of the `$` lines is the administrator's own; a connection that takes no G-code never turns it on
      body.allow_dollar = dollarSwitchShown(body.connection.kind, session.role) && form.m.allow_dollar === true;
      if (form.isNew) await api.addMachine(body);
      else await api.updateMachine(form.m.id, body);
      say(t("mach_saved"), "ok");
      setForm(null);
      reload();
    } catch (e) {
      say(err(e), "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: string) => {
    try {
      await api.deleteMachine(id);
      say(t("mach_deleted"), "ok");
      reload();
    } catch (e) {
      say(err(e), "error");
    }
  };
  const exportAll = () => {
    const url = URL.createObjectURL(new Blob([machineExport(data ?? [])], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "eh3d-machines.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const importFile = async (file: File | undefined) => {
    if (!file) return;
    const list = machineImport(await file.text());
    if (!list) {
      say(t("mach_import_bad"), "error");
      return;
    }
    const have = new Set((data ?? []).map((m) => m.id));
    let made = 0;
    let skipped = 0;
    for (const m of list) {
      if (have.has(m.id) || machineProblems(m).length > 0) {
        skipped += 1;
        continue;
      }
      try {
        await api.addMachine(m);
        made += 1;
      } catch (e) {
        say(err(e), "error");
        skipped += 1;
      }
    }
    say(t("mach_imported", { n: made, skipped }), skipped > 0 && made === 0 ? "error" : "ok");
    reload();
  };
  const problemText = (p: MachineProblem) => t(`mach_problem_${p}` as TextKey);

  return (
    <div className="stack">
      <Card title={t("nav_machines")} wide actions={
        <>
          <label className="button">
            {t("mach_import")}
            <input type="file" accept=".json,application/json" hidden onChange={(e) => void importFile(e.target.files?.[0])} />
          </label>
          <button disabled={!data || data.length === 0} onClick={exportAll}>
            {t("mach_export")}
          </button>
          <button className="primary" onClick={() => setForm({ isNew: true, m: emptyMachine() })}>
            {t("mach_new")}
          </button>
        </>
      }>
        {error != null && <p className="error">{err(error)}</p>}
        {data && data.length === 0 && <Empty>{t("mach_empty")}</Empty>}
        {data && data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>{t("mach_name")}</th>
                <th>{t("mach_station")}</th>
                <th>{t("mach_connection")}</th>
                <th>{t("mach_cfg")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong>
                    <small>
                      {m.id} · {m.model}
                    </small>
                  </td>
                  <td>{m.station || "-"}</td>
                  <td>
                    <Badge tone={m.connection.kind === "demo" ? "dim" : "run"}>{t(connectionKey(m.connection.kind))}</Badge>
                    {m.connection.kind === "node" && <small>{m.connection.address}</small>}
                    {m.allow_dollar === true && <small className="warn">{t("mach_dollar_on")}</small>}
                    {m.connection.kind === "grbl" && (
                      <small>
                        {m.connection.port ?? m.connection.address} · {m.connection.baud ?? DEFAULT_BAUD}
                      </small>
                    )}
                  </td>
                  <td>{cfgKeys(m.cfg).length}</td>
                  <td className="row-actions">
                    <button onClick={() => setForm({ isNew: false, m: toInput(m) })}>{t("act_edit")}</button>
                    <button onClick={() => setForm({ isNew: true, m: { ...toInput(m), allow_dollar: false, id: copyId(m.id, (data ?? []).map((x) => x.id)), name: `${m.name} (${t("mach_copy")})` } })}>{t("act_copy")}</button>
                    <DangerButton label={t("act_delete")} onConfirm={() => void remove(m.id)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {form && (
        <Card title={form.isNew ? t("mach_new") : t("mach_edit", { name: form.m.name })} wide>
          <div className="form-grid">
            <Field label={t("mach_id")} hint={t("mach_id_hint")}>
              <input value={form.m.id} disabled={!form.isNew} onChange={(e) => set({ id: e.target.value })} aria-invalid={problems.includes("id")} />
            </Field>
            <Field label={t("mach_name")}>
              <input value={form.m.name} onChange={(e) => set({ name: e.target.value })} aria-invalid={problems.includes("name")} />
            </Field>
            <Field label={t("mach_model")} hint={t("mach_model_hint")}>
              <input list="models" value={form.m.model} onChange={(e) => set({ model: e.target.value })} />
              <datalist id="models">
                {MODELS.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </Field>
            <Field label={t("mach_station")} hint={t("mach_station_hint")}>
              <input value={form.m.station} onChange={(e) => set({ station: e.target.value })} aria-invalid={problems.includes("station")} />
            </Field>
            <Field label={t("mach_connection")}>
              <select value={form.m.connection.kind} onChange={(e) => setConn({ kind: e.target.value as ConnectionKind })}>
                {CONNECTION_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {t(connectionKey(k))}
                  </option>
                ))}
              </select>
            </Field>
            {form.m.connection.kind === "grbl" && (
              <>
                <Field label={t("mach_port")} hint={t("mach_port_hint")}>
                  <input value={form.m.connection.port ?? ""} placeholder="/dev/ttyUSB0" onChange={(e) => setConn({ port: e.target.value })} aria-invalid={problems.includes("port")} />
                </Field>
                <Field label={t("mach_baud")} hint={t("mach_baud_hint")}>
                  <input type="number" min={1200} max={2000000} step={1} value={form.m.connection.baud ?? DEFAULT_BAUD} onChange={(e) => setConn({ baud: Number(e.target.value) })} aria-invalid={problems.includes("baud")} />
                </Field>
                <p className="hint grid-note">{t("mach_grbl_note")}</p>
              </>
            )}
            {form.m.connection.kind === "node" && (
              <>
                <Field label={t("mach_address")} hint="192.168.0.50:5800">
                  <input value={form.m.connection.address ?? ""} onChange={(e) => setConn({ address: e.target.value })} aria-invalid={problems.includes("address")} />
                </Field>
                <Field label={t("mach_token")} hint={t("mach_token_hint")}>
                  <input type="password" autoComplete="off" value={form.m.connection.token ?? ""} onChange={(e) => setConn({ token: e.target.value })} />
                </Field>
              </>
            )}
          </div>
          {dollarSwitchShown(form.m.connection.kind, session.role) && (
            <label className="check-row">
              <input type="checkbox" checked={form.m.allow_dollar === true} onChange={(e) => set({ allow_dollar: e.target.checked })} />
              <span>
                <strong>{t("mach_allow_dollar")}</strong>
                <small className="hint">{t("mach_allow_dollar_hint")}</small>
              </span>
            </label>
          )}
          <div className="form-grid wide-fields">
            <Field label={t("mach_dcf")}>
              <textarea rows={6} value={form.m.dcf} onChange={(e) => set({ dcf: e.target.value })} />
            </Field>
            <Field label={t("mach_rcf")}>
              <textarea rows={6} value={form.m.rcf} onChange={(e) => set({ rcf: e.target.value })} />
            </Field>
            <Field label={t("mach_cfg")} hint={t("mach_cfg_hint")}>
              <textarea rows={6} value={form.m.cfg} onChange={(e) => set({ cfg: e.target.value })} spellCheck={false} />
            </Field>
          </div>
          {problems.length > 0 && <p className="error">{problems.map(problemText).join(" · ")}</p>}
          <div className="form-actions">
            <button className="primary" disabled={saving || problems.length > 0} onClick={() => void save()}>
              {t("act_save")}
            </button>
            <button onClick={() => setForm(null)}>{t("act_cancel")}</button>
          </div>
        </Card>
      )}
    </div>
  );
}

export function AccessPage() {
  const { api, session, t, err, say } = useApp();
  const users = usePolled(() => api.users(), 0);
  const tokens = usePolled(() => api.tokens(), 0);
  const [nu, setNu] = useState({ name: "", role: "operator" as Role, password: "" });
  const [nt, setNt] = useState({ name: "", role: "operator" as Role, days: "" });
  const [shown, setShown] = useState<{ name: string; token: string } | null>(null);
  const [copied, setCopied] = useState<boolean | null>(null);

  const guard = async (what: () => Promise<unknown>, done: () => void) => {
    try {
      await what();
      done();
    } catch (e) {
      say(err(e), "error");
    }
  };
  const userOk = validName(nu.name) && validPassword(nu.password);

  return (
    <div className="stack">
      <Card title={t("acc_users")} wide>
        {users.error != null && <p className="error">{err(users.error)}</p>}
        <table className="table">
          <thead>
            <tr>
              <th>{t("acc_name")}</th>
              <th>{t("acc_role")}</th>
              <th>{t("acc_status")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(users.data ?? []).map((u) => (
              <tr key={u.name}>
                <td>
                  <strong>{u.name}</strong>
                  {u.name === session.name && <small>{t("acc_you")}</small>}
                </td>
                <td>
                  <select value={u.role} onChange={(e) => void guard(() => api.updateUser(u.name, { role: e.target.value as Role }), users.reload)}>
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`role_${r}` as TextKey)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <Badge tone={u.disabled ? "bad" : "ok"}>{t(u.disabled ? "acc_disabled" : "acc_active")}</Badge>
                </td>
                <td className="row-actions">
                  <button onClick={() => void guard(() => api.updateUser(u.name, { disabled: !u.disabled }), users.reload)}>{t(u.disabled ? "acc_enable" : "acc_disable")}</button>
                  <DangerButton label={t("act_delete")} onConfirm={() => void guard(() => api.deleteUser(u.name), users.reload)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <h4>{t("acc_user_new")}</h4>
        <div className="form-grid">
          <Field label={t("acc_name")} hint={t("mach_id_hint")}>
            <input value={nu.name} onChange={(e) => setNu({ ...nu, name: e.target.value })} />
          </Field>
          <Field label={t("acc_role")}>
            <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role_${r}` as TextKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("acc_password")} hint={t("password_rule")}>
            <input type="password" autoComplete="new-password" value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} />
          </Field>
        </div>
        <div className="form-actions">
          <button className="primary" disabled={!userOk} onClick={() => void guard(() => api.addUser(nu.name, nu.role, nu.password), () => { setNu({ name: "", role: "operator", password: "" }); users.reload(); })}>
            {t("act_create")}
          </button>
        </div>
      </Card>

      <Card title={t("acc_tokens")} wide>
        <p className="hint">{t("acc_tokens_help")}</p>
        {shown && (
          <div className="secret" role="alert">
            <strong>{t("acc_token_once", { name: shown.name })}</strong>
            <code>{shown.token}</code>
            <button onClick={() => void copyText(shown.token).then(setCopied)}>{t("act_copy")}</button>
            {copied !== null && <span role="status">{copied ? t("act_copied") : t("act_copy_failed")}</span>}
            <button onClick={() => { setShown(null); setCopied(null); }}>{t("act_close")}</button>
          </div>
        )}
        {tokens.data && tokens.data.length === 0 && <Empty>{t("acc_tokens_empty")}</Empty>}
        {tokens.data && tokens.data.length > 0 && (
          <table className="table">
            <thead>
              <tr>
                <th>{t("acc_name")}</th>
                <th>{t("acc_role")}</th>
                <th>{t("acc_created")}</th>
                <th>{t("acc_last_used")}</th>
                <th>{t("acc_expires")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {tokens.data.map((k) => {
                const state = tokenState(k, Math.floor(Date.now() / 1000));
                return (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td>{t(`role_${k.role}` as TextKey)}</td>
                  <td>{new Date(k.created * 1000).toLocaleString()}</td>
                  <td>
                    {k.last_used != null ? new Date(k.last_used * 1000).toLocaleString() : t("acc_unused")}
                    {state === "stale" && <Badge tone="wait">{t("acc_stale")}</Badge>}
                  </td>
                  <td>
                    {k.expires != null ? new Date(k.expires * 1000).toLocaleString() : t("acc_never")}
                    {state === "expired" && <Badge tone="bad">{t("acc_expired")}</Badge>}
                  </td>
                  <td className="row-actions">
                    <DangerButton label={t("act_delete")} onConfirm={() => void guard(() => api.deleteToken(k.id), tokens.reload)} />
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="form-grid">
          <Field label={t("acc_token_name")} hint={t("acc_token_name_hint")}>
            <input value={nt.name} onChange={(e) => setNt({ ...nt, name: e.target.value })} />
          </Field>
          <Field label={t("acc_role")}>
            <select value={nt.role} onChange={(e) => setNt({ ...nt, role: e.target.value as Role })}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {t(`role_${r}` as TextKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("acc_token_days")} hint={t("acc_token_days_hint")}>
            <input inputMode="numeric" value={nt.days} onChange={(e) => setNt({ ...nt, days: e.target.value })} />
          </Field>
        </div>
        <div className="form-actions">
          <button
            className="primary"
            disabled={nt.name.trim() === "" || tokenDays(nt.days) === null}
            onClick={() =>
              void guard(
                async () => {
                  const r = await api.addToken(nt.name.trim(), nt.role, tokenDays(nt.days) ?? undefined);
                  setShown({ name: nt.name.trim(), token: r.token }); setCopied(null);
                },
                () => {
                  setNt({ name: "", role: "operator", days: "" });
                  tokens.reload();
                },
              )
            }
          >
            {t("act_create")}
          </button>
        </div>
      </Card>
    </div>
  );
}

/** The settings of `server.cfg`, with what each one does. The API does not show them (they are the server's own file), so this is a reference, not a form. */
export const SERVER_SETTINGS: { key: string; value: string; text: TextKey }[] = [
  { key: "listen", value: "0.0.0.0:18200", text: "srv_listen" },
  { key: "data_dir", value: "data", text: "srv_data_dir" },
  { key: "session_hours", value: "12", text: "srv_session_hours" },
  { key: "max_body_mb", value: "8", text: "srv_max_body_mb" },
  { key: "keep_jobs", value: "200", text: "srv_keep_jobs" },
  { key: "studio_dir", value: "-", text: "srv_studio_dir" },
  { key: "updates_dir", value: "-", text: "srv_updates_dir" },
  { key: "gcode_finish_wait_s", value: "900", text: "srv_gcode_finish_wait_s" },
  { key: "exit_on_panic", value: "true", text: "srv_exit_on_panic" },
  { key: "trust_forwarded_for", value: "false", text: "srv_trust_forwarded_for" },
  { key: "persist_sessions", value: "false", text: "srv_persist_sessions" },
  { key: "token_default_days", value: "0", text: "srv_token_default_days" },
  { key: "events_ping_s", value: "30", text: "srv_events_ping_s" },
  { key: "events_idle_s", value: "90", text: "srv_events_idle_s" },
  { key: "audit_file", value: "true", text: "srv_audit_file" },
  { key: "job_log", value: "true", text: "srv_job_log" },
  { key: "log_max_kb", value: "1024", text: "srv_log_max_kb" },
];

/** The switches the running server reports (`features` of the health check), in the order they are shown: the ones that change what it trusts or what happens on a failure first. */
export const SWITCHES_SHOWN = ["trust_forwarded_for", "exit_on_panic", "persist_sessions", "url_token", "local_until_setup"] as const;

export function ServerPage() {
  const { api, t } = useApp();
  const health = usePolled(() => api.health(), 0);
  return (
    <div className="stack">
      <Card title={t("nav_server")} wide>
        <dl className="facts">
          <dt>{t("ov_version")}</dt>
          <dd>{health.data ? `${health.data.name} ${health.data.version}` : "-"}</dd>
          <dt>{t("srv_address")}</dt>
          <dd>{window.location.host}</dd>
        </dl>
      </Card>
      {health.data?.features && (
        <Card title={t("srv_in_force")} wide>
          <p className="hint">{t("srv_in_force_help")}</p>
          <dl className="facts">
            {SWITCHES_SHOWN.filter((k) => health.data?.features && k in health.data.features).map((k) => (
              <div key={k} style={{ display: "contents" }}>
                <dt>
                  <code>{k}</code>
                </dt>
                <dd>
                  <Badge tone={health.data?.features?.[k] ? "ok" : "dim"}>{t(health.data?.features?.[k] ? "srv_on" : "srv_off")}</Badge>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
      <Card title={t("srv_settings")} wide>
        <p className="hint">{t("srv_settings_help")}</p>
        <table className="table">
          <thead>
            <tr>
              <th>{t("srv_key")}</th>
              <th>{t("srv_default")}</th>
              <th>{t("srv_what")}</th>
            </tr>
          </thead>
          <tbody>
            {SERVER_SETTINGS.map((s) => (
              <tr key={s.key}>
                <td>
                  <code>{s.key}</code>
                </td>
                <td>
                  <code>{s.value}</code>
                </td>
                <td>{t(s.text)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

const STEP_TEXT: Record<string, TextKey> = { download: "up_step_download", verify: "up_step_verify", install: "up_step_install", restart: "up_step_restart", restore: "up_step_restore" };

function Bar({ percent, tone }: { percent: number; tone: string }) {
  const p = Math.max(0, Math.min(100, percent));
  return (
    <div className={`up-bar ${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)}>
      <i style={{ width: `${p}%` }} />
    </div>
  );
}

/** The updates of the installed services from the releases of GitHub: what is installed and what is the latest (with what changes in it), a button for each service or for all,
 * and, while the helper works, the steps of the job with a bar each, the bar of the whole, the log, and the earlier jobs. */
export function UpdatesPage() {
  const { api, t, err, say } = useApp();
  const [fast, setFast] = useState(false);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const { data, error, reload } = usePolled(() => api.updates(), fast ? 1 : 10);
  const busy = data ? updatesBusy(data) : false;
  // while the helper works the page asks every second; when the server itself restarts the requests fail for a while and then answer again
  if (busy !== fast) setFast(busy);
  const ask = async (what: () => Promise<unknown>) => {
    try {
      await what();
      say(t("up_asked"), "ok");
      setFast(true);
      reload();
    } catch (e) {
      say(err(e), "error");
    }
  };
  if (error != null && !data) return <p className="error">{err(error)}</p>;
  if (!data) return <Empty>…</Empty>;
  if (!data.enabled) {
    return (
      <Card title={t("nav_updates")} wide>
        <p className="hint">{t("up_off")}</p>
      </Card>
    );
  }
  const todo = updatable(data);
  const steps = data.steps ?? [];
  const history = data.history ?? [];
  const nameOf = (id: string) => data.components.find((c) => c.id === id)?.name ?? id;
  const stepLabel = (id: string) => {
    const { component, step } = splitStep(id);
    const key = STEP_TEXT[step];
    return `${nameOf(component)}: ${key ? t(key) : step}`;
  };
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const stateTone = data.state === "error" ? "bad" : data.state === "done" ? "ok" : data.state === "idle" ? "dim" : "run";
  const showJob = data.state !== "idle" || steps.length > 0;
  return (
    <div className="stack">
      <Card
        title={t("nav_updates")}
        wide
        actions={
          <>
            <button disabled={busy} onClick={() => void ask(() => api.checkUpdates())}>
              {t("up_check")}
            </button>
            <button className="primary" disabled={busy || todo.length === 0} onClick={() => void ask(() => api.applyUpdates(todo))}>
              {t("up_apply", { n: todo.length })}
            </button>
          </>
        }
      >
        <p className="hint">{t("up_help")}</p>
        <table className="table">
          <thead>
            <tr>
              <th>{t("up_component")}</th>
              <th>{t("up_installed")}</th>
              <th>{t("up_latest")}</th>
              <th>{t("up_status")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.components.flatMap((c) => [
              <tr key={c.id}>
                <td>{c.name}</td>
                <td>
                  <code>{c.installed ?? "-"}</code>
                </td>
                <td>
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noreferrer">
                      <code>{c.latest ?? "-"}</code>
                    </a>
                  ) : (
                    <code>{c.latest ?? "-"}</code>
                  )}
                </td>
                <td>
                  <Badge tone={c.latest == null ? "dim" : c.newer ? "wait" : "ok"}>{c.latest == null ? t("up_unknown") : c.newer ? t("up_newer") : t("up_current")}</Badge>
                </td>
                <td className="up-actions">
                  <button className={c.newer ? "primary" : ""} disabled={busy || c.latest == null} onClick={() => void ask(() => api.applyUpdates([c.id]))}>
                    {c.newer ? t("up_update") : t("up_reinstall")}
                  </button>
                  {c.can_undo === true && (
                    <button
                      disabled={busy}
                      title={t("up_undo_help")}
                      onClick={() => {
                        const to = c.previous ?? t("up_undo_earlier");
                        if (window.confirm(t("up_undo_ask", { name: c.name, v: to }))) void ask(() => api.undoUpdates([c.id]));
                      }}
                    >
                      {c.previous ? t("up_undo_to", { v: c.previous }) : t("up_undo")}
                    </button>
                  )}
                  {c.latest != null && (
                    <button aria-expanded={open.has(c.id)} onClick={() => toggle(c.id)}>
                      {open.has(c.id) ? t("up_changes_hide") : t("up_changes")}
                    </button>
                  )}
                </td>
              </tr>,
              ...(open.has(c.id) && c.latest != null
                ? [
                    <tr key={`${c.id}-notes`} className="up-notes-row">
                      <td colSpan={5}>
                        <div className="up-notes" role="region" aria-label={t("up_changes_in", { v: c.latest })}>
                          <strong>{t("up_changes_in", { v: c.latest })}</strong>
                          {parseReleaseNotes(c.notes ?? "").length === 0 ? (
                            <p className="hint">{t("up_changes_none")}</p>
                          ) : (
                            <ul>
                              {parseReleaseNotes(c.notes ?? "").map((line, i) => (
                                <li key={i} className={line.kind === "text" ? "up-note-text" : ""}>
                                  {line.text}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </td>
                    </tr>,
                  ]
                : []),
            ])}
          </tbody>
        </table>
        {todo.length === 0 && data.components.some((c) => c.latest != null) && <p className="hint">{t("up_nothing")}</p>}
        <p className="hint">{t("up_restart")}</p>
      </Card>
      {showJob && (
        <Card
          title={t("up_job")}
          wide
          actions={
            <button onClick={() => void copyText(data.log.join("\n")).then((ok) => say(t(ok ? "act_copied" : "act_copy_failed"), ok ? "ok" : "error"))}>{t("act_copy")}</button>
          }
        >
          <p>
            <Badge tone={stateTone}>{t(`up_state_${data.state}` as TextKey)}</Badge> {data.message}
          </p>
          {steps.length > 0 && (
            <>
              <div className="up-total">
                <span>{t("up_total")}</span>
                <Bar percent={data.percent ?? 0} tone={stateTone} />
                <span>{data.percent ?? 0} %</span>
              </div>
              <ul className="up-steps">
                {steps.map((st) => (
                  <li key={st.id} className={st.state}>
                    <span>{stepLabel(st.id)}</span>
                    <Bar percent={st.state === "done" || st.state === "skipped" ? 100 : st.percent} tone={st.state} />
                  </li>
                ))}
              </ul>
            </>
          )}
          {error != null && busy && <p className="hint">{t("up_waiting")}</p>}
          {studioReplaced(data) && (
            <p>
              <button className="primary" onClick={() => window.location.reload()}>
                {t("up_reload")}
              </button>{" "}
              <span className="hint">{t("up_reload_help")}</span>
            </p>
          )}
          {data.log.length > 0 && <pre className="log">{data.log.join("\n")}</pre>}
        </Card>
      )}
      {history.length > 0 && (
        <Card
          title={t("up_history")}
          wide
          actions={
            <button disabled={busy} onClick={() => window.confirm(t("up_history_clear_ask")) && void ask(() => api.clearUpdateHistory())}>
              {t("up_history_clear")}
            </button>
          }
        >
          <ul className="up-history">
            {[...history].reverse().map((h) => (
              <li key={`${h.id}-${h.kind}`}>
                <span>{new Date(h.started * 1000).toLocaleString()}</span>
                <strong>{h.kind === "check" ? t("up_kind_check") : h.kind === "undo" ? t("up_kind_undo") : t("up_kind_apply")}</strong>
                <span>{h.kind === "check" ? "" : h.label}</span>
                <Badge tone={h.state === "done" ? "ok" : "bad"}>{t(h.state === "done" ? "up_state_done" : "up_state_error")}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
