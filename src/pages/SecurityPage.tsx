/* The security of the single login: the session of this person, the open sessions (listed and closed), what each role may do, the policy of the server with the switches that
 * deserve a look, the audit, and the keys with the fingerprint of the TLS certificate. No secret is ever shown: the policy and the keys have none, and the id of a session is
 * not its token. The switches the server lets change while it runs (`editable`) have a button; a value looser than recommended is asked twice, and the others are the file's
 * (`server.cfg` and a restart). */
import { useMemo, useState } from "react";
import type { AuthPolicySwitch } from "../services/types";
import { useApp, usePolled } from "../context";
import { Badge, Card, DangerButton, Empty } from "../components/ui";
import { useServices } from "../services/context";
import { auditDetail, closesCurrent, editableKind, orderSessions, policyRows, policyScore, secondsLeft, spanText, switchValue, wholeNumber } from "../services/authsvc";
import { whenText, useNowS } from "../services/format";
import { allowedActions } from "../services/permissions";
import type { Action } from "../services/permissions";
import { ApiError } from "../api";
import { ROLES } from "../types";
import { SERVER_SETTINGS } from "./Configure";
import type { TextKey } from "../i18n";

/** One action stands for each row of the table of the roles. */
const MATRIX: Action[] = ["projects.read", "projects.write", "jobs.start", "jobs.cancel", "machines.manage", "policy.read"];

export function SecurityPage() {
  const { t, err, say, session } = useApp();
  const sv = useServices();
  const admin = sv.allowed("policy.read");
  const [all, setAll] = useState(false);
  const sessions = usePolled(() => sv.auth.sessions(admin && all), 15, [admin && all]);
  const policy = usePolled(() => (admin ? sv.auth.policy() : Promise.resolve(null)), 0, [admin]);
  const [auditWho, setAuditWho] = useState("");
  const [auditEvent, setAuditEvent] = useState("");
  const audit = usePolled(() => (admin ? sv.auth.audit({ who: auditWho, event: auditEvent, limit: 100 }) : Promise.resolve(null)), 0, [admin, auditWho, auditEvent]);
  const keys = usePolled(() => (admin ? sv.auth.keys() : Promise.resolve(null)), 0, [admin]);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [weak, setWeak] = useState<{ key: string; value: boolean | number } | null>(null);
  const now = useNowS(true);
  const claims = sv.claims;
  const person = !(claims?.is_token ?? session.is_token);
  const list = useMemo(() => orderSessions(sessions.data ?? []), [sessions.data]);

  const close = async (id: string) => {
    try {
      await sv.auth.closeSession(id);
      say(t("up_state_done"), "ok");
      if (closesCurrent(list, id)) window.location.reload();
      else sessions.reload();
    } catch (e) {
      say(err(e), "error");
    }
  };
  const logoutAll = async () => {
    try {
      const r = await sv.auth.logoutAll();
      void r;
      say(t("up_state_done"), "ok");
      window.location.reload();
    } catch (e) {
      say(err(e), "error");
    }
  };
  const renew = async () => {
    try {
      await sv.auth.refresh();
      say(t("up_state_done"), "ok");
      sessions.reload();
    } catch (e) {
      say(err(e), "error");
    }
  };

  /** Changes one switch; the server says when the value is looser than recommended, and the person then confirms it. */
  const change = async (key: string, value: boolean | number, confirmWeak = false) => {
    try {
      await sv.auth.changePolicy(key, value, confirmWeak);
      setWeak(null);
      say(t("up_state_done"), "ok");
      policy.reload();
      audit.reload();
    } catch (e) {
      if (e instanceof ApiError && e.code === "weak_confirm_required") setWeak({ key, value });
      else say(err(e), "error");
    }
  };
  const editor = (sw: AuthPolicySwitch) => {
    const kind = policy.data ? editableKind(policy.data, sw) : null;
    if (kind === "flag") {
      const next = !(sw.value as boolean);
      return <button onClick={() => void change(sw.key, next)}>{`${t("act_edit")}: ${next ? t("srv_on") : t("srv_off")}`}</button>;
    }
    if (kind === "number") {
      const text = typed[sw.key] ?? String(sw.value);
      const n = wholeNumber(text);
      return (
        <span className="row-actions">
          <input aria-label={sw.key} inputMode="numeric" size={6} value={text} onChange={(e) => setTyped({ ...typed, [sw.key]: e.target.value })} />
          <button disabled={n === null || n === sw.value} onClick={() => n !== null && void change(sw.key, n)}>
            {t("act_save")}
          </button>
        </span>
      );
    }
    return null;
  };

  const score = policy.data ? policyScore(policy.data) : null;
  // the keys whose change is read when the server starts
  const restartKeys = policy.data?.restart_required ?? [];
  return (
    <div className="stack">
      <Card title={t("sec_session")}>
        <dl className="facts">
          <dt>{t("acc_name")}</dt>
          <dd>{claims?.name ?? session.name}</dd>
          <dt>{t("acc_role")}</dt>
          <dd>{t(`role_${claims?.role ?? session.role}` as TextKey)}</dd>
          <dt>{t("pj_app")}</dt>
          <dd>{claims?.app ?? "-"}</dd>
          <dt>{t("sec_scopes")}</dt>
          <dd>{claims?.scopes ? claims.scopes.join(", ") || "-" : t("sec_scopes_all")}</dd>
          <dt>{t("sec_last_seen")}</dt>
          <dd>{whenText(claims?.last_seen)}</dd>
          <dt>{t("acc_expires")}</dt>
          <dd>{claims?.expires ? `${whenText(claims.expires)} (${spanText(secondsLeft(claims.expires, now))})` : t("acc_never")}</dd>
        </dl>
        {person ? (
          <div className="form-actions">
            <button onClick={() => void renew()}>{t("sec_renew")}</button>
            <DangerButton label={t("sec_logout_all")} onConfirm={() => void logoutAll()} />
          </div>
        ) : (
          <p className="hint">{t("myacc_token_session")}</p>
        )}
      </Card>

      <Card
        title={t("sec_sessions")}
        wide
        actions={
          <>
            {admin && (
              <label className="check">
                <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} />
                {t("sec_all_users")}
              </label>
            )}
            <button onClick={sessions.reload}>{t("act_refresh")}</button>
          </>
        }
      >
        {sessions.error != null && <p className="error">{err(sessions.error)}</p>}
        {sessions.data === null && sessions.error == null ? (
          <p className="muted">{t("svc_loading")}</p>
        ) : list.length === 0 ? (
          <Empty>{t("sec_no_sessions")}</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>{t("acc_name")}</th>
                <th>{t("acc_role")}</th>
                <th>{t("pj_app")}</th>
                <th>{t("job_created")}</th>
                <th>{t("sec_last_seen")}</th>
                <th>{t("acc_expires")}</th>
                <th>IP</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.name} {s.current && <Badge tone="ok">{t("sec_this")}</Badge>}
                  </td>
                  <td>{t(`role_${s.role}` as TextKey)}</td>
                  <td>{s.app || "-"}</td>
                  <td>{whenText(s.created)}</td>
                  <td>{whenText(s.last_seen)}</td>
                  <td>{spanText(secondsLeft(s.expires, now))}</td>
                  <td>{s.ip ?? "-"}</td>
                  <td>
                    <div className="row-actions">
                      <DangerButton label={s.current ? t("act_signout") : t("act_close")} onConfirm={() => void close(s.id)} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title={t("sec_roles")} wide>
        <table className="table matrix">
          <thead>
            <tr>
              <th>{t("sec_may")}</th>
              {ROLES.map((r) => (
                <th key={r} className={r === (claims?.role ?? session.role) ? "me" : ""}>
                  {t(`role_${r}` as TextKey)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((a) => (
              <tr key={a}>
                <td>{t(`perm_${a.replace(".", "_")}` as TextKey)}</td>
                {ROLES.map((r) => {
                  const yes = allowedActions(r).includes(a);
                  return (
                    <td key={r}>
                      <span aria-label={yes ? t("srv_on") : t("srv_off")}>{yes ? "✔" : "–"}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {admin && (
          <button onClick={() => (window.location.hash = "#/access")}>{t("nav_access")}</button>
        )}
      </Card>

      {admin && (
        <Card title={t("sec_policy")} wide actions={<button onClick={policy.reload}>{t("act_refresh")}</button>}>
          {policy.error != null && <p className="error">{err(policy.error)}</p>}
          {policy.data === null && policy.error == null && <p className="muted">{t("svc_loading")}</p>}
          {policy.data && score && (
            <>
              <p role="status" className={score.attention > 0 ? "warn" : ""}>
                {score.attention > 0 ? `▲ ${t("sec_attention", { n: score.attention })}` : `✔ ${t("sec_strict")}`} · {score.safe}/{score.total}
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("srv_key")}</th>
                    <th>{t("srv_in_force")}</th>
                    <th>{t("up_status")}</th>
                    <th>{t("srv_what")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {policyRows(policy.data).map(({ sw, attention }) => {
                    const known = SERVER_SETTINGS.find((s) => s.key === sw.key);
                    return (
                      <tr key={sw.key} className={attention ? "flag" : ""}>
                        <td>
                          <code>{sw.key}</code>
                        </td>
                        <td>
                          <code>{switchValue(sw.value)}</code>
                        </td>
                        <td>{attention ? <Badge tone="wait">▲ {t("sec_look")}</Badge> : <Badge tone="ok">✔ {t("sec_strict")}</Badge>}</td>
                        <td>
                          {known ? t(known.text) : ""}
                          {restartKeys.includes(sw.key) && <span className="hint"> {t("sec_restart_needed")}</span>}
                        </td>
                        <td>{editor(sw)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {policy.data.extra_apps.length > 0 && (
                <p className="hint">
                  auth_extra_apps: {policy.data.extra_apps.join(", ")}
                </p>
              )}
              {weak && (
                <p role="alert" className="warn">
                  {t("sec_weak_confirm")} <code>{`${weak.key} = ${switchValue(weak.value)}`}</code>{" "}
                  <button onClick={() => void change(weak.key, weak.value, true)}>{t("act_confirm")}</button> <button onClick={() => setWeak(null)}>{t("act_cancel")}</button>
                </p>
              )}
              <p className="hint">{t("sec_policy_hint")}</p>
            </>
          )}
        </Card>
      )}

      {admin && (
        <Card title={t("sec_audit")} wide actions={<button onClick={audit.reload}>{t("act_refresh")}</button>}>
          <div className="filters">
            <label>
              {t("acc_name")}
              <input value={auditWho} onChange={(e) => setAuditWho(e.target.value)} />
            </label>
            <label>
              {t("sec_event")}
              <input value={auditEvent} onChange={(e) => setAuditEvent(e.target.value)} />
            </label>
          </div>
          {audit.error != null && <p className="error">{err(audit.error)}</p>}
          {audit.data === null && audit.error == null ? (
            <p className="muted">{t("svc_loading")}</p>
          ) : audit.data && !audit.data.enabled ? (
            <Empty>{t("sec_audit_off")}</Empty>
          ) : audit.data && audit.data.lines.length === 0 ? (
            <Empty>{t("sec_audit_none")}</Empty>
          ) : (
            audit.data && (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t("sec_when")}</th>
                    <th>{t("sec_event")}</th>
                    <th>{t("acc_name")}</th>
                    <th>{t("sec_detail")}</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.data.lines.map((l, i) => (
                    <tr key={`${l.at}-${i}`}>
                      <td>{whenText(l.at)}</td>
                      <td>
                        <code>{l.event}</code>
                      </td>
                      <td>{l.who ?? "-"}</td>
                      <td>{auditDetail(l)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </Card>
      )}

      {admin && (
        <Card title={t("sec_keys")} wide actions={<button onClick={keys.reload}>{t("act_refresh")}</button>}>
          {keys.error != null && <p className="error">{err(keys.error)}</p>}
          {keys.data === null && keys.error == null && <p className="muted">{t("svc_loading")}</p>}
          {keys.data && (
            <>
              <dl className="facts">
                <dt>{t("sec_tls")}</dt>
                <dd>{keys.data.tls.sha256 ? <code>{keys.data.tls.sha256}</code> : "-"}</dd>
              </dl>
              {!keys.data.tls.configured && <p className="hint">{t("sec_tls_none")}</p>}
              {keys.data.tokens.length === 0 ? (
                <Empty>{t("acc_tokens_empty")}</Empty>
              ) : (
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t("srv_key")}</th>
                      <th>{t("acc_name")}</th>
                      <th>{t("acc_role")}</th>
                      <th>{t("acc_created")}</th>
                      <th>{t("acc_last_used")}</th>
                      <th>{t("acc_expires")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {keys.data.tokens.map((k) => (
                      <tr key={k.id}>
                        <td>
                          <code>{k.id}</code>
                        </td>
                        <td>{k.name}</td>
                        <td>{k.role}</td>
                        <td>{whenText(k.created)}</td>
                        <td>{k.last_used ? whenText(k.last_used) : t("acc_unused")}</td>
                        <td>{k.expires ? whenText(k.expires) : t("acc_never")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </Card>
      )}
    </div>
  );
}
