/* The security of the single login: the session of this person, the open sessions (listed and closed), what each role may do, the policy of the server with the switches that
 * deserve a look, and what this server does not show yet (the audit, the keys and the fingerprint of the TLS). No secret is ever shown: the policy has none, and the id of a
 * session is not its token. The switches are the file's: Studio reads them and says so; changing one is a change of `server.cfg` and a restart. */
import { useMemo, useState } from "react";
import { useApp, usePolled } from "../context";
import { Badge, Card, DangerButton, Empty } from "../components/ui";
import { useServices } from "../services/context";
import { secondsLeft, closesCurrent, orderSessions, policyRows, policyScore, spanText, switchValue } from "../services/authsvc";
import { whenText, useNowS } from "../services/format";
import { allowedActions } from "../services/permissions";
import type { Action } from "../services/permissions";
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

  const score = policy.data ? policyScore(policy.data) : null;
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
                        <td>{known ? t(known.text) : ""}</td>
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
              <p className="hint">{t("sec_policy_hint")}</p>
            </>
          )}
        </Card>
      )}

      <Card title={t("svc_unavailable")} wide>
        <p className="hint">{t("sec_missing_hint")}</p>
        <ul className="missing">
          {(["sec_audit", "sec_keys"] as const).map((k) => (
            <li key={k}>
              <strong>{t(k)}</strong> <Badge tone="dim">{t("svc_unavailable")}</Badge>
            </li>
          ))}
        </ul>
        <fieldset disabled className="audit-filters">
          <legend>{t("sec_audit")}</legend>
          <label>
            {t("acc_name")}
            <input />
          </label>
          <label>
            {t("jobs_kind")}
            <input />
          </label>
        </fieldset>
      </Card>
    </div>
  );
}
