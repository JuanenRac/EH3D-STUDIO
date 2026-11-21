/* The eight languages of the interface, the official ones of the ecosystem: English, Spanish, Italian, German, French, European Portuguese, Chinese and
 * Japanese. They are the rows of texts.ts, one text per language in that order. A test checks that every key has its eight texts, with the same {markers}.
 * None of the eight is written from right to left, so the pages need no right-to-left layout. `{name}` in a text is filled from the values given to t().
 * GPL-3.0-or-later. */
import { ROWS } from "./texts";
import { ApiError } from "./api";

/** The eight languages whose texts are the rows of texts.ts, in the order of the columns. */
export const CORE_LANGS = ["en", "es", "it", "de", "fr", "pt", "zh", "ja"] as const;
export const LANGS = CORE_LANGS;
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

/** The language of a code of the browser (es-MX, pt_BR, zh-Hant-TW), or null when it is none of the eight. Every region reads its main language. */
export function langOfCode(code: string): Lang | null {
  const base = code.trim().toLowerCase().replace(/_/g, "-").split("-")[0];
  return isLang(base) ? base : null;
}

/** The first language of the list of the browser that is one of the eight, English otherwise (a person whose language is not one of them reads English). */
export function browserLang(languages: readonly string[]): Lang {
  for (const l of languages) {
    const found = langOfCode(l);
    if (found) return found;
  }
  return "en";
}

/** The language to start with: the one saved by the person when it is still one of the eight, otherwise the one of the browser (a retired language falls to it). */
export function startLang(saved: string | null | undefined, languages: readonly string[]): Lang {
  return isLang(saved) ? saved : browserLang(languages);
}

/** The text of a key: the language, then English, then Spanish. */
export function text(lang: Lang, key: TextKey, vars?: Record<string, string | number>): string {
  const row = ROWS[key] as readonly string[];
  const at = (l: Lang) => row[(CORE_LANGS as readonly string[]).indexOf(l)];
  let s = at(lang) ?? at("en") ?? at("es") ?? "";
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** The refusal of the server (or of the network) as a sentence in the language of the person. Codes that are not known say what the server said. */
export function errorText(lang: Lang, e: unknown): string {
  if (!(e instanceof ApiError)) return e instanceof Error ? e.message : String(e);
  const key = `err_${e.code}` as TextKey;
  if (key in ROWS) return text(lang, key) + (e.detail && e.code !== "unreachable" && e.code !== "timeout" ? ` (${e.detail})` : "");
  return e.detail ? `${e.code}: ${e.detail}` : e.code;
}
