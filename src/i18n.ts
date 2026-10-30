/* The eight languages of the interface. Every text is one row of eight, in the order of LANGS; a test checks that no row is missing a language and that the
 * Chinese and Japanese rows are really in those scripts. `{name}` in a text is filled from the values given to t(). GPL-3.0-or-later. */
import { ROWS } from "./texts";
import { ApiError } from "./api";

export const LANGS = ["en", "es", "it", "de", "fr", "pt", "zh", "ja"] as const;
export type Lang = (typeof LANGS)[number];

/** The name of each language in itself. */
export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  es: "Español",
  it: "Italiano",
  de: "Deutsch",
  fr: "Français",
  pt: "Português (Portugal)",
  zh: "中文",
  ja: "日本語",
};

export type TextKey = keyof typeof ROWS;

export function isLang(s: string | null | undefined): s is Lang {
  return !!s && (LANGS as readonly string[]).includes(s);
}

/** The language of the browser when it is one of the eight, English otherwise. */
export function browserLang(languages: readonly string[]): Lang {
  for (const l of languages) {
    const base = l.toLowerCase().split("-")[0];
    if (isLang(base)) return base;
  }
  return "en";
}

export function text(lang: Lang, key: TextKey, vars?: Record<string, string | number>): string {
  const row = ROWS[key] as readonly string[];
  let s = row[LANGS.indexOf(lang)] ?? row[0];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** The refusal of the server (or of the network) as a sentence in the language of the person. Codes that are not known say what the server said. */
export function errorText(lang: Lang, e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : String(e);
  const key = `err_${e.code}` as TextKey;
  if (key in ROWS) return text(lang, key) + (e.detail && e.code !== "unreachable" ? ` (${e.detail})` : "");
  return e.detail ? `${e.code}: ${e.detail}` : e.code;
}
