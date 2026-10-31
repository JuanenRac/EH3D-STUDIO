/* The shell: the sidebar with the pages in their three groups (Monitor, Configure, Account), the top bar with who is signed in, the page, and the line of news. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Api, ApiError } from "./api";
import { AppContext, THEMES, Toast, makeErr, makeText } from "./context";
import type { AppState, ThemeId } from "./context";
import { useAttention, useReachable } from "./attention";
import { browserLang, isLang, text } from "./i18n";
import type { Lang, TextKey } from "./i18n";
import { parseRoute, pagesFor } from "./model";
import type { PageId } from "./model";
import type { Session } from "./types";
import { Login } from "./pages/Login";
import { FleetPage, JobsPage, LivePage, Overview } from "./pages/Monitor";
import { JobPage } from "./pages/JobDetail";
import { PreparePage } from "./pages/Prepare";
import { MachinePage } from "./pages/MachinePage";
import { AccessPage, MachinesPage, ServerPage, UpdatesPage } from "./pages/Configure";
import { AboutPage, AccountPage, PreferencesPage } from "./pages/Account";

// set at the build from package.json (vite.config.ts)
declare const __STUDIO_VERSION__: string;
export const VERSION: string = __STUDIO_VERSION__;

function read(key: string): string | null {
  try {
    return localStorage.getItem(`eh3d-studio.${key}`);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(`eh3d-studio.${key}`);
    else localStorage.setItem(`eh3d-studio.${key}`, value);
  } catch {
    /* a browser that keeps nothing: the choice lasts until the page is closed */
  }
}

function routeFromHash() {
  return parseRoute(window.location.hash);
}

const GROUPS = ["monitor", "configure", "account"] as const;

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = read("lang");
    return isLang(saved) ? saved : browserLang(navigator.languages ?? [navigator.language]);
  });
  const [theme, setTheme] = useState<ThemeId>(() => {
    const saved = read("theme");
    return (THEMES as readonly string[]).includes(saved ?? "") ? (saved as ThemeId) : "forge";
  });
  const [refreshS, setRefreshS] = useState<number>(() => {
    const n = Number(read("refresh") ?? 5);
    return [0, 2, 5, 10, 30].includes(n) ? n : 5;
  });
  const [alerts, setAlerts] = useState<boolean>(() => read("alerts") === "1");
  const api = useMemo(() => new Api(read("token")), []);
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [route, setRoute] = useState(routeFromHash);
  const page: PageId = route.page;
  const [news, setNews] = useState<{ message: string; kind: "ok" | "error" } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
  }, [theme, lang]);
  useEffect(() => {
    const on = () => setRoute(routeFromHash());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  const signOutLocally = useCallback(() => {
    api.token = null;
    write("token", null);
    setSession(null);
  }, [api]);

  // a saved token is checked once; a refusal means it has expired
  useEffect(() => {
    if (!api.token) {
      setChecked(true);
      return;
    }
    api.session().then(
      (s) => {
        setSession(s);
        setChecked(true);
      },
      (e) => {
        if (e instanceof ApiError && e.status === 401) signOutLocally();
        setChecked(true);
      },
    );
  }, [api, signOutLocally]);

  const signedIn = async () => {
    write("token", api.token);
    setSession(await api.session());
  };

  const t = useMemo(() => makeText(lang), [lang]);
  const err = useMemo(() => makeErr(lang), [lang]);
  const changeLang = (l: Lang) => {
    setLang(l);
    write("lang", l);
  };

  useAttention(api, session != null, refreshS, alerts, text(lang, "alert_waiting"));
  const reachable = useReachable(api, session != null);
  if (!checked) return null;
  if (!session) return <Login api={api} lang={lang} onLang={changeLang} onSignedIn={() => void signedIn()} />;

  const state: AppState = {
    api,
    session,
    lang,
    theme,
    refreshS,
    alerts,
    t,
    err: (e) => {
      // a refusal because the login ended takes the person back to the sign-in
      if (e instanceof ApiError && e.status === 401) signOutLocally();
      return err(e);
    },
    say: (message, kind = "ok") => setNews({ message, kind }),
  };
  const allowed = pagesFor(session.role);
  const current = allowed.some((p) => p.id === page) ? page : "overview";
  const go = (id: PageId) => {
    window.location.hash = `#/${id}`;
    setRoute({ page: id, param: "" });
  };

  let body;
  switch (current) {
    case "overview":
      body = <Overview />;
      break;
    case "fleet":
      body = <FleetPage />;
      break;
    case "machine":
      body = <MachinePage id={route.param} key={route.param} />;
      break;
    case "prepare":
      body = <PreparePage machineId={route.param} key={route.param} />;
      break;
    case "jobs":
      body = <JobsPage />;
      break;
    case "job":
      body = <JobPage id={route.param} key={route.param} />;
      break;
    case "live":
      body = <LivePage />;
      break;
    case "machines":
      body = <MachinesPage />;
      break;
    case "access":
      body = <AccessPage />;
      break;
    case "server":
      body = <ServerPage />;
      break;
    case "updates":
      body = <UpdatesPage />;
      break;
    case "account":
      body = <AccountPage />;
      break;
    case "preferences":
      body = (
        <PreferencesPage
          onLang={changeLang}
          onTheme={(x) => {
            setTheme(x);
            write("theme", x);
          }}
          onAlerts={(on) => {
            setAlerts(on);
            write("alerts", on ? "1" : "0");
          }}
          onRefresh={(s) => {
            setRefreshS(s);
            write("refresh", String(s));
          }}
        />
      );
      break;
    default:
      body = <AboutPage version={VERSION} />;
  }

  return (
    <AppContext.Provider value={state}>
      <div className="shell">
        <aside className="sidebar">
          <div className="brand">
            <span className="brand-mark">E</span>
            <div>
              <strong>EH3D</strong> <em>STUDIO</em>
            </div>
          </div>
          <nav>
            {GROUPS.map((g) => {
              const pages = allowed.filter((p) => p.group === g && !p.hidden);
              if (pages.length === 0) return null;
              return (
                <div key={g} className="nav-group">
                  <small className="nav-group-title">{t(`group_${g}` as TextKey)}</small>
                  {pages.map((p) => (
                    <button key={p.id} className={p.id === current ? "active" : ""} onClick={() => go(p.id)}>
                      {t(`nav_${p.id}` as TextKey)}
                    </button>
                  ))}
                </div>
              );
            })}
          </nav>
        </aside>
        <div className="main">
          <header className="topbar">
            <h2>{t(`nav_${current}` as TextKey)}</h2>
            <div className="who">
              <span>
                {session.name} · {t(`role_${session.role}` as TextKey)}
              </span>
              <button
                onClick={() => {
                  void api.logout().catch(() => undefined);
                  signOutLocally();
                }}
              >
                {t("act_signout")}
              </button>
            </div>
          </header>
          {!reachable && (
            <div className="lost" role="alert">
              {t("net_lost")}
            </div>
          )}
          <div className="page" key={current + route.param}>
            {body}
          </div>
          <footer className="statusbar">
            <span>EH3D Studio {VERSION}</span>
            <span>{window.location.host}</span>
          </footer>
        </div>
        {news && <Toast message={news.message} kind={news.kind} onDone={() => setNews(null)} />}
      </div>
    </AppContext.Provider>
  );
}
