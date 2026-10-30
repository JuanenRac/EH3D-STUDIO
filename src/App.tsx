/* The shell: the sidebar with the pages in their three groups (Monitor, Configure, Account), the top bar with who is signed in, the page, and the line of news. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Api, ApiError } from "./api";
import { AppContext, THEMES, Toast, makeErr, makeText } from "./context";
import type { AppState, ThemeId } from "./context";
import { browserLang, isLang } from "./i18n";
import type { Lang, TextKey } from "./i18n";
import { isPageId, pagesFor } from "./model";
import type { PageId } from "./model";
import type { Session } from "./types";
import { Login } from "./pages/Login";
import { FleetPage, JobsPage, LivePage, Overview } from "./pages/Monitor";
import { AccessPage, MachinesPage, ServerPage, UpdatesPage } from "./pages/Configure";
import { AboutPage, AccountPage, PreferencesPage } from "./pages/Account";

export const VERSION = "0.0.1";

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

function pageFromHash(): PageId {
  const id = window.location.hash.replace(/^#\/?/, "");
  return isPageId(id) ? id : "overview";
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
  const api = useMemo(() => new Api(read("token")), []);
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);
  const [page, setPage] = useState<PageId>(pageFromHash);
  const [news, setNews] = useState<{ message: string; kind: "ok" | "error" } | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.lang = lang;
  }, [theme, lang]);
  useEffect(() => {
    const on = () => setPage(pageFromHash());
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

  if (!checked) return null;
  if (!session) return <Login api={api} lang={lang} onLang={changeLang} onSignedIn={() => void signedIn()} />;

  const state: AppState = {
    api,
    session,
    lang,
    theme,
    refreshS,
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
    setPage(id);
  };

  let body;
  switch (current) {
    case "overview":
      body = <Overview />;
      break;
    case "fleet":
      body = <FleetPage />;
      break;
    case "jobs":
      body = <JobsPage />;
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
              const pages = allowed.filter((p) => p.group === g);
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
          <div className="page" key={current}>
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
