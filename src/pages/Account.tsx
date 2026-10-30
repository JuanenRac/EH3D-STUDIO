/* The group Account: the password of the person, the language and the theme, and what this is. */
import { useEffect, useState } from "react";
import { useApp } from "../context";
import { THEMES } from "../context";
import { Card, Field } from "../components/ui";
import { validPassword } from "../model";
import { LANGS, LANG_NAMES } from "../i18n";
import type { Lang, TextKey } from "../i18n";
import type { ThemeId } from "../context";

export function AccountPage() {
  const { api, session, t, err, say } = useApp();
  const [old, setOld] = useState("");
  const [fresh, setFresh] = useState("");
  const [again, setAgain] = useState("");
  const ok = old !== "" && validPassword(fresh) && fresh === again && fresh !== old;
  const change = async () => {
    try {
      await api.changePassword(old, fresh);
      setOld("");
      setFresh("");
      setAgain("");
      say(t("myacc_changed"), "ok");
    } catch (e) {
      say(err(e), "error");
    }
  };
  return (
    <Card title={t("nav_account")}>
      <dl className="facts">
        <dt>{t("acc_name")}</dt>
        <dd>{session.name}</dd>
        <dt>{t("acc_role")}</dt>
        <dd>{t(`role_${session.role}` as TextKey)}</dd>
      </dl>
      {session.is_token ? (
        <p className="hint">{t("myacc_token_session")}</p>
      ) : (
        <>
          <h4>{t("myacc_change")}</h4>
          <div className="form-grid">
            <Field label={t("myacc_old")}>
              <input type="password" autoComplete="current-password" value={old} onChange={(e) => setOld(e.target.value)} />
            </Field>
            <Field label={t("myacc_new")} hint={t("password_rule")}>
              <input type="password" autoComplete="new-password" value={fresh} onChange={(e) => setFresh(e.target.value)} />
            </Field>
            <Field label={t("myacc_again")}>
              <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} aria-invalid={again !== "" && again !== fresh} />
            </Field>
          </div>
          <div className="form-actions">
            <button className="primary" disabled={!ok} onClick={() => void change()}>
              {t("myacc_change")}
            </button>
          </div>
        </>
      )}
    </Card>
  );
}

export function PreferencesPage({ onLang, onTheme, onRefresh, onAlerts }: { onLang: (l: Lang) => void; onTheme: (t: ThemeId) => void; onRefresh: (s: number) => void; onAlerts: (on: boolean) => void }) {
  const { lang, theme, refreshS, alerts, t } = useApp();
  return (
    <Card title={t("nav_preferences")}>
      <div className="form-grid">
        <Field label={t("pref_language")}>
          <select value={lang} onChange={(e) => onLang(e.target.value as Lang)}>
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_NAMES[l]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("pref_theme")}>
          <select value={theme} onChange={(e) => onTheme(e.target.value as ThemeId)}>
            {THEMES.map((id) => (
              <option key={id} value={id}>
                {t(`theme_${id}` as TextKey)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("pref_refresh")} hint={t("pref_refresh_hint")}>
          <select value={refreshS} onChange={(e) => onRefresh(Number(e.target.value))}>
            {[0, 2, 5, 10, 30].map((s) => (
              <option key={s} value={s}>
                {s === 0 ? t("pref_manual") : `${s} s`}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("pref_alerts")} hint={t("pref_alerts_hint")}>
          <span className="check">
            <input
              type="checkbox"
              checked={alerts}
              onChange={(e) => {
                const on = e.target.checked;
                if (on && "Notification" in window && Notification.permission === "default") void Notification.requestPermission();
                onAlerts(on);
              }}
            />
            {t("pref_alerts_on")}
          </span>
        </Field>
      </div>
    </Card>
  );
}

export function AboutPage({ version }: { version: string }) {
  const { api, t } = useApp();
  const [server, setServer] = useState<string>("-");
  useEffect(() => {
    api.health().then((h) => setServer(`${h.name} ${h.version}`), () => undefined);
  }, [api]);
  return (
    <Card title={t("nav_about")}>
      <p>{t("about_text")}</p>
      <dl className="facts">
        <dt>EH3D Studio</dt>
        <dd>{version}</dd>
        <dt>{t("ov_server")}</dt>
        <dd>{server}</dd>
        <dt>{t("about_licence")}</dt>
        <dd>GPL-3.0-or-later</dd>
      </dl>
      <p className="hint">{t("about_independent")}</p>
    </Card>
  );
}
