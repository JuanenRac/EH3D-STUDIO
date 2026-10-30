/* The first screen: the sign-in, or, while the server has no user, the set-up with the code that the server prints on its console. */
import { useEffect, useState } from "react";
import type { Api } from "../api";
import { Field } from "../components/ui";
import { validName, validPassword } from "../model";
import { LANGS, LANG_NAMES, errorText, text } from "../i18n";
import type { Lang } from "../i18n";

export function Login({ api, lang, onLang, onSignedIn }: { api: Api; lang: Lang; onLang: (l: Lang) => void; onSignedIn: () => void }) {
  const t = (k: Parameters<typeof text>[1], v?: Record<string, string | number>) => text(lang, k, v);
  const [needed, setNeeded] = useState<boolean | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.setupNeeded().then(setNeeded, (e) => {
      setNeeded(false);
      setError(errorText(lang, e));
    });
  }, [api, lang]);

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (needed) await api.setup(code.trim(), name.trim(), password);
      await api.login(name.trim(), password);
      onSignedIn();
    } catch (e) {
      setError(errorText(lang, e));
    } finally {
      setBusy(false);
    }
  };
  const ok = needed ? validName(name) && validPassword(password) && code.trim() !== "" : name.trim() !== "" && password !== "";

  return (
    <main className="login">
      <form
        className="login-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok && !busy) void submit();
        }}
      >
        <h1>
          EH3D <span>STUDIO</span>
        </h1>
        <p className="muted">{needed ? t("login_setup_help") : t("login_help")}</p>
        {needed && (
          <Field label={t("login_code")} hint={t("login_code_hint")}>
            <input value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" inputMode="numeric" />
          </Field>
        )}
        <Field label={t("acc_name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="username" autoFocus />
        </Field>
        <Field label={t("acc_password")} hint={needed ? t("password_rule") : undefined}>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={needed ? "new-password" : "current-password"} />
        </Field>
        {error && <p className="error">{error}</p>}
        <button className="primary" type="submit" disabled={!ok || busy || needed === null}>
          {needed ? t("login_create") : t("login_signin")}
        </button>
        <select aria-label="language" value={lang} onChange={(e) => onLang(e.target.value as Lang)}>
          {LANGS.map((l) => (
            <option key={l} value={l}>
              {LANG_NAMES[l]}
            </option>
          ))}
        </select>
      </form>
    </main>
  );
}
