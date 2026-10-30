/* The group Configure: the machines of the server (each with how to reach it, its stations and its configuration files), the people and the tokens of the programs,
 * and the reference of the settings of the server itself. */
import { useState } from "react";
import { useApp, usePolled } from "../context";
import { Badge, Card, DangerButton, Empty, Field } from "../components/ui";
import { cfgKeys, emptyMachine, machineProblems, toInput, validName, validPassword } from "../model";
import type { MachineProblem } from "../model";
import type { ConnectionKind, MachineInput, Role } from "../types";
import { ROLES } from "../types";
import type { TextKey } from "../i18n";

const MODELS = ["ccd-mtc", "ccd-atc", "ccd2-mtc", "ccd2-atc", "ccd-premium-mtc", "ccd-premium-atc"];

export function MachinesPage() {
  const { api, t, err, say } = useApp();
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
      const body: MachineInput = { ...form.m, connection: form.m.connection.kind === "demo" ? { kind: "demo" } : form.m.connection };
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
  const problemText = (p: MachineProblem) => t(`mach_problem_${p}` as TextKey);

  return (
    <div className="stack">
      <Card title={t("nav_machines")} wide actions={<button className="primary" onClick={() => setForm({ isNew: true, m: emptyMachine() })}>{t("mach_new")}</button>}>
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
                    <Badge tone={m.connection.kind === "node" ? "run" : "dim"}>{t(m.connection.kind === "node" ? "mach_kind_node" : "mach_kind_demo")}</Badge>
                    {m.connection.kind === "node" && <small>{m.connection.address}</small>}
                  </td>
                  <td>{cfgKeys(m.cfg).length}</td>
                  <td className="row-actions">
                    <button onClick={() => setForm({ isNew: false, m: toInput(m) })}>{t("act_edit")}</button>
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
                <option value="demo">{t("mach_kind_demo")}</option>
                <option value="node">{t("mach_kind_node")}</option>
              </select>
            </Field>
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
  const [nt, setNt] = useState({ name: "", role: "operator" as Role });
  const [shown, setShown] = useState<{ name: string; token: string } | null>(null);

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
            <button onClick={() => void navigator.clipboard?.writeText(shown.token)}>{t("act_copy")}</button>
            <button onClick={() => setShown(null)}>{t("act_close")}</button>
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
                <th />
              </tr>
            </thead>
            <tbody>
              {tokens.data.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td>{t(`role_${k.role}` as TextKey)}</td>
                  <td>{new Date(k.created * 1000).toLocaleString()}</td>
                  <td className="row-actions">
                    <DangerButton label={t("act_delete")} onConfirm={() => void guard(() => api.deleteToken(k.id), tokens.reload)} />
                  </td>
                </tr>
              ))}
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
        </div>
        <div className="form-actions">
          <button
            className="primary"
            disabled={nt.name.trim() === ""}
            onClick={() =>
              void guard(
                async () => {
                  const r = await api.addToken(nt.name.trim(), nt.role);
                  setShown({ name: nt.name.trim(), token: r.token });
                },
                () => {
                  setNt({ name: "", role: "operator" });
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
];

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
