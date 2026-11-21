/* The settings of the server, drawn from its contract: the groups in the order of the contract, and for each setting its label, help and warning in the language of the person, the value
 * in force, the default, whether a change applies at once or needs a restart, and the control of its type. A setting the server changes while it runs (`PUT /auth/policy`) is edited
 * here by an administrator; one that is set in `server.cfg` is shown with its value and says so; a secret never shows its value. A login that is not an administrator reads the light view of
 * the values in force (`GET /settings/values`, any login, a few KB, with an ETag) and draws them with the texts of the copy kept in Studio, read-only; the page says when the contract
 * hash of the server is not the one of the copy. When neither can be read the copy is shown, read-only, with the reason. A key the copy does not know is drawn too, with the generic
 * control. GPL-3.0-or-later. */
import { useRef, useState } from "react";
import { useApp, usePolled } from "../context";
import { useServices } from "../services/context";
import { ApiError } from "../api";
import type { TextKey } from "../i18n";
import { EMBEDDED_CONTRACT } from "../services/embeddedcontract";
import { PERSISTENCE_NOTES, SWITCH_NOTES } from "../services/safety";
import {
  LIGHT_POLL_S,
  LightCache,
  canWrite,
  contractText,
  controlKind,
  groupSettings,
  isHighRisk,
  loadSettings,
  parseTyped,
  readContract,
  readLight,
  sameValue,
  shownValue,
  unlistedSettings,
  valueOf,
  writeSetting,
} from "../services/settingscontract";
import type { LoadedContract, Setting, SettingsContract } from "../services/settingscontract";
import { Badge, Card } from "./ui";

interface Notice {
  kind: "ok" | "error";
  text: string;
}

/** A change waiting for the person: a risky one is asked before it is sent, and a value looser than recommended is asked when the server says so. */
interface Pending {
  setting: Setting;
  value: unknown;
  /** `risk`: the warning of the setting; `weak`: the server asked for `confirm_weak`. */
  why: "risk" | "weak";
}

export function ServerSettings({ embedded = EMBEDDED_CONTRACT }: { embedded?: SettingsContract }) {
  const { t, err, say, lang } = useApp();
  const sv = useServices();
  // the last light answer and its ETag, kept between the rounds; another login forgets it
  const cache = useRef(new LightCache());
  const role = useRef<string>(sv.who.role);
  // the full contract (an administrator) is read once and when asked; the light view is cheap (an answer with the same ETag is a few bytes), so a login that reads it asks again by itself
  const pollS = sv.who.role === "admin" ? 0 : LIGHT_POLL_S;
  const loaded = usePolled<LoadedContract>(
    async () => {
      if (role.current !== sv.who.role) {
        role.current = sv.who.role;
        cache.current.clear();
      }
      const read = await loadSettings(sv.who.role, { full: () => readContract(sv.http), light: (etag) => readLight(sv.http, etag) }, embedded, cache.current);
      return read.loaded;
    },
    pollS,
    [sv.who.role],
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [notices, setNotices] = useState<Record<string, Notice>>({});
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const data = loaded.data;
  const live = data?.source === "live";
  const shows = data?.source === "live" || data?.source === "light"; // the values in force are there
  const secretKeys = new Set(data?.secretKeys ?? []);
  const hiddenKeys = new Set(data?.hidden ?? []);
  const truncatedKeys = new Set(data?.truncated ?? []);
  const known = new Set(embedded.settings.map((s) => s.key));
  const label = (s: Setting) => contractText(s.label, lang) || s.key;

  const note = (key: string, n: Notice | null) =>
    setNotices((all) => {
      const next = { ...all };
      if (n) next[key] = n;
      else delete next[key];
      return next;
    });

  /** Sends one change by the route the contract names; a refusal is said with the text of its code. */
  const send = async (s: Setting, value: unknown, confirmWeak: boolean) => {
    setBusy(s.key);
    try {
      const answer = await writeSetting(sv.http, s, value, confirmWeak);
      setPending(null);
      setDrafts((d) => {
        const next = { ...d };
        delete next[s.key];
        return next;
      });
      const restart = answer.changed?.restart_required === true || (answer.changed === undefined && s.apply === "restart");
      note(s.key, { kind: "ok", text: t(restart ? "ssc_saved_restart" : "ssc_saved") });
      loaded.reload();
    } catch (e) {
      if (e instanceof ApiError && e.code === "weak_confirm_required") {
        setPending({ setting: s, value, why: "weak" });
      } else {
        setPending(null);
        note(s.key, { kind: "error", text: err(e) });
        say(err(e), "error");
      }
    } finally {
      setBusy(null);
    }
  };

  /** A change a person asked for: a risky setting is asked first (and then sent with the confirmation the server may want); the rest goes straight. */
  const ask = (s: Setting, value: unknown) => {
    note(s.key, null);
    if (isHighRisk(s)) setPending({ setting: s, value, why: "risk" });
    else void send(s, value, false);
  };

  const control = (s: Setting) => {
    const current = valueOf(s, data?.values ?? {});
    const kind = controlKind(s);
    const editable = live && canWrite(sv.who, s);
    const draft = drafts[s.key];
    const shown = draft ?? (kind === "list" ? shownValue(current) : shownValue(current ?? s.default));
    const typed = draft !== undefined ? parseTyped(s, draft) : null;
    const problem = typed && !typed.ok ? typed.problem : null;
    const restore = editable && current !== undefined && !sameValue(current, s.default) && s.default !== null;

    if (s.secret) return <span className="muted">{t("ssc_secret")}</span>;
    if (!editable) {
      if (s.write.via === "file") return <span className="hint">{t("ssc_in_file")}</span>;
      return null;
    }
    return (
      <span className="row-actions">
        {kind === "switch" && (
          <label className="check">
            <input
              type="checkbox"
              role="switch"
              aria-label={s.key}
              disabled={busy === s.key}
              checked={(current ?? s.default) === true}
              onChange={(e) => ask(s, e.target.checked)}
            />
            {t((current ?? s.default) === true ? "srv_on" : "srv_off")}
          </label>
        )}
        {(kind === "number" || kind === "text" || kind === "list") && (
          <>
            <input
              aria-label={s.key}
              inputMode={kind === "number" ? "numeric" : undefined}
              size={kind === "number" ? 8 : 24}
              value={shown}
              aria-invalid={problem !== null}
              onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}
            />
            {s.unit && <span className="hint">{s.unit}</span>}
            <button disabled={busy === s.key || typed === null || !typed.ok || sameValue(typed.value, current)} onClick={() => typed && typed.ok && ask(s, typed.value)}>
              {t("act_save")}
            </button>
          </>
        )}
        {kind === "select" && (
          <>
            <select aria-label={s.key} value={shown} onChange={(e) => setDrafts({ ...drafts, [s.key]: e.target.value })}>
              {(s.values ?? []).map((v) => (
                <option key={String(v)} value={String(v)}>
                  {String(v)}
                </option>
              ))}
            </select>
            <button disabled={busy === s.key || typed === null || !typed.ok || sameValue(typed.value, current)} onClick={() => typed && typed.ok && ask(s, typed.value)}>
              {t("act_save")}
            </button>
          </>
        )}
        {restore && (
          <button disabled={busy === s.key} onClick={() => ask(s, s.default)}>
            {t("ssc_restore")}
          </button>
        )}
      </span>
    );
  };

  const row = (s: Setting) => {
    const current = valueOf(s, data?.values ?? {});
    const kind = controlKind(s);
    const extra: TextKey | undefined = PERSISTENCE_NOTES[s.key] ?? SWITCH_NOTES[s.key];
    const draft = drafts[s.key];
    const typed = draft !== undefined ? parseTyped(s, draft) : null;
    const notice = notices[s.key];
    const warn = contractText(s.warning, lang);
    return (
      <tr key={s.key} data-setting={s.key}>
        <td>
          <strong>{label(s)}</strong> <code>{s.key}</code>
          <div className="hint">{contractText(s.help, lang)}</div>
          {(isHighRisk(s) || s.apply === "restart") && warn && <div className="hint">{warn}</div>}
          {extra && <div className="hint">{t(extra)}</div>}
          {kind === "number" && typeof s.min === "number" && typeof s.max === "number" && (
            <div className="hint">
              {s.min}–{s.max}
              {s.unit ? ` ${s.unit}` : ""}
            </div>
          )}
          {kind === "list" && <div className="hint">{t("ssc_list_hint")}</div>}
          {typed && !typed.ok && typed.problem === "number" && (
            <div role="alert" className="error">
              {t("ssc_bad_number", { min: s.min ?? "", max: s.max ?? "" })}
            </div>
          )}
          {typed && !typed.ok && typed.problem === "text" && (
            <div role="alert" className="error">
              {t("ssc_bad_text", { n: s.max_length ?? 0 })}
            </div>
          )}
          {notice && (
            <div role={notice.kind === "error" ? "alert" : "status"} className={notice.kind === "error" ? "error" : "hint"}>
              {notice.text}
            </div>
          )}
        </td>
        <td>
          {s.secret || secretKeys.has(s.key) ? (
            <span className="muted">●●●</span>
          ) : hiddenKeys.has(s.key) ? (
            <span className="muted">{t("ssc_hidden")}</span>
          ) : current === undefined ? (
            <span className="muted">-</span>
          ) : typeof current === "boolean" ? (
            <Badge tone={current ? "ok" : "dim"}>{t(current ? "srv_on" : "srv_off")}</Badge>
          ) : (
            <code>{(shownValue(current) || "-") + (truncatedKeys.has(s.key) ? "…" : "")}</code>
          )}
          {!s.secret && s.default !== null && (
            <div className="hint">
              {t("srv_default")}: <code>{typeof s.default === "boolean" ? t(s.default ? "srv_on" : "srv_off") : shownValue(s.default) || "-"}</code>
            </div>
          )}
        </td>
        <td>
          {s.write.via !== "none" && <Badge tone={s.apply === "restart" ? "wait" : "ok"}>{t(s.apply === "restart" ? "ssc_apply_restart" : "ssc_apply_now")}</Badge>}
          {isHighRisk(s) && <Badge tone="bad">▲ {t("ssc_risk_high")}</Badge>}
          {shows && !known.has(s.key) && <Badge tone="dim">{t("ssc_unknown")}</Badge>}
        </td>
        <td>{control(s)}</td>
      </tr>
    );
  };

  const groups = data ? groupSettings(data.contract) : [];
  const unlisted = data && shows ? unlistedSettings(data.contract, data.values, [...(data.secretKeys ?? []), ...(data.hidden ?? [])]) : [];
  const confirmText = pending ? (pending.why === "weak" ? t("sec_weak_confirm") : t("ssc_confirm_risk", { key: pending.setting.key, warning: contractText(pending.setting.warning, lang) })) : "";

  return (
    <Card title={t("srv_settings")} wide actions={<button onClick={loaded.reload}>{t("act_refresh")}</button>}>
      <p className="hint">{t("ssc_help")}</p>
      {data === null && <p className="muted">{t("svc_loading")}</p>}
      {data && live && <p className="hint">{t("ssc_live", { v: data.serverVersion ?? "-" })}</p>}
      {data && data.source === "light" && <p className="hint">{t("ssc_light", { v: data.serverVersion ?? "-" })}</p>}
      {data && data.source === "embedded" && (
        <p role="alert" className="warn">
          {t("ssc_embedded", { why: data.why ?? "" })}
        </p>
      )}
      {data && shows && data.hash === "differs" && (
        <p role="alert" className="warn">
          {t("ssc_hash_differs")}
        </p>
      )}
      {data && live && sv.who.role !== "admin" && <p className="hint">{t("ssc_readonly_role")}</p>}
      {pending && (
        <p role="alert" className="warn">
          {confirmText} <code>{`${pending.setting.key} = ${shownValue(pending.value) || "-"}`}</code>{" "}
          <button disabled={busy !== null} onClick={() => void send(pending.setting, pending.value, pending.why === "weak" || pending.setting.confirm_when_looser)}>
            {t("act_confirm")}
          </button>{" "}
          <button onClick={() => setPending(null)}>{t("act_cancel")}</button>
        </p>
      )}
      {groups.map((g) => (
        <section key={g.id} data-group={g.id}>
          <h4>{contractText(g.label, lang) || g.id}</h4>
          <table className="table">
            <thead>
              <tr>
                <th>{t("srv_key")}</th>
                <th>{t("srv_in_force")}</th>
                <th>{t("up_status")}</th>
                <th />
              </tr>
            </thead>
            <tbody>{g.settings.map(row)}</tbody>
          </table>
        </section>
      ))}
      {unlisted.length > 0 && (
        <section data-group="other">
          <h4>{t("ssc_other")}</h4>
          <table className="table">
            <tbody>{unlisted.map(row)}</tbody>
          </table>
        </section>
      )}
    </Card>
  );
}

export default ServerSettings;
