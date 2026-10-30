/* What every page shares: the client of the API, who is signed in, the language and the theme, the way the screen is refreshed, and the line of news at the bottom. */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Api } from "./api";
import { errorText, text } from "./i18n";
import type { Lang, TextKey } from "./i18n";
import type { Session } from "./types";

export const THEMES = ["forge", "paper", "neon", "midnight"] as const;
export type ThemeId = (typeof THEMES)[number];

export interface AppState {
  api: Api;
  session: Session;
  lang: Lang;
  theme: ThemeId;
  /** How often the pages that follow the server ask it again, in seconds. */
  refreshS: number;
  t: (key: TextKey, vars?: Record<string, string | number>) => string;
  /** A refusal or a failure as a sentence in the language of the person. */
  err: (e: unknown) => string;
  say: (message: string, kind?: "ok" | "error") => void;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const v = useContext(AppContext);
  if (!v) throw new Error("useApp outside of the application");
  return v;
}

export function makeText(lang: Lang) {
  return (key: TextKey, vars?: Record<string, string | number>) => text(lang, key, vars);
}

export function makeErr(lang: Lang) {
  return (e: unknown) => errorText(lang, e);
}

/** Runs `load` now and then every `seconds` while the page is shown; the answer of a request that finished after the page was left is dropped. */
export function usePolled<T>(load: () => Promise<T>, seconds: number, deps: unknown[] = []): { data: T | null; error: unknown; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [tick, setTick] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let alive = true;
    const run = () => {
      loadRef.current().then(
        (d) => {
          if (alive) {
            setData(d);
            setError(null);
          }
        },
        (e) => {
          if (alive) setError(e);
        },
      );
    };
    run();
    const id = seconds > 0 ? setInterval(run, seconds * 1000) : undefined;
    return () => {
      alive = false;
      if (id) clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seconds, tick, ...deps]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, error, reload };
}

export function Toast({ message, kind, onDone }: { message: string; kind: "ok" | "error"; onDone: () => void }): ReactNode {
  useEffect(() => {
    const id = setTimeout(onDone, kind === "error" ? 8000 : 3500);
    return () => clearTimeout(id);
  }, [message, kind, onDone]);
  return (
    <div className={`toast ${kind}`} role="status">
      {message}
    </div>
  );
}
