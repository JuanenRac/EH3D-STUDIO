/* The 37 languages of the interface. The first eight (CORE_LANGS) are the rows of texts.ts, one text per language in that order; the other 29 are
 * the JSON files of locales/ (pt-br and fr-ca only hold what differs from pt and fr). A text that a language lacks is taken from its main language,
 * then from English, then from Spanish. A test checks that every language has every key, with the same {markers}. None of the 37 is written from right
 * to left, so the pages need no right-to-left layout. `{name}` in a text is filled from the values given to t(). GPL-3.0-or-later. */
import { ROWS } from "./texts";
import { LOCALES } from "./locales";
import { ApiError } from "./api";

/** The eight languages whose texts are the rows of texts.ts, in the order of the columns. */
export const CORE_LANGS = ["en", "es", "it", "de", "fr", "pt", "zh", "ja"] as const;
export const LANGS = [
  ...CORE_LANGS,
  "bg", "hr", "cs", "da", "nl", "et", "fi", "el", "hu", "ga", "lv", "lt", "mt", "pl", "ro", "sk", "sl", "sv", "no", "is", "uk", "ru", "sr", "sq", "ca", "gl", "eu",
  "pt-br", "fr-ca",
] as const;
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
  bg: "Български",
  hr: "Hrvatski",
  cs: "Čeština",
  da: "Dansk",
  nl: "Nederlands",
  et: "Eesti",
  fi: "Suomi",
  el: "Ελληνικά",
  hu: "Magyar",
  ga: "Gaeilge",
  lv: "Latviešu",
  lt: "Lietuvių",
  mt: "Malti",
  pl: "Polski",
  ro: "Română",
  sk: "Slovenčina",
  sl: "Slovenščina",
  sv: "Svenska",
  no: "Norsk",
  is: "Íslenska",
  uk: "Українська",
  ru: "Русский",
  sr: "Српски",
  sq: "Shqip",
  ca: "Català",
  gl: "Galego",
  eu: "Euskara",
  "pt-br": "Português (Brasil)",
  "fr-ca": "Français (Canada)",
};

/** The variants of a main language: they hold only the texts that differ. */
export const VARIANT_OF: Partial<Record<Lang, Lang>> = { "pt-br": "pt", "fr-ca": "fr" };

export type TextKey = keyof typeof ROWS;

export function isLang(s: string | null | undefined): s is Lang {
  return !!s && (LANGS as readonly string[]).includes(s);
}

/** The language of a code of the browser (es-MX, pt_BR, nb, zh-Hant-TW), or null when it is none of the 37. Brazil is pt-br, Canada fr-ca, nb and nn are no. */
export function langOfCode(code: string): Lang | null {
  const parts = code.trim().toLowerCase().replace(/_/g, "-").split("-");
  const base = parts[0] === "nb" || parts[0] === "nn" ? "no" : parts[0];
  if (base === "pt" && parts[1] === "br") return "pt-br";
  if (base === "fr" && parts[1] === "ca") return "fr-ca";
  return isLang(base) ? base : null;
}

/** The first language of the list of the browser that is one of the 37, English otherwise. */
export function browserLang(languages: readonly string[]): Lang {
  for (const l of languages) {
    const found = langOfCode(l);
    if (found) return found;
  }
  return "en";
}

/** The text of a key in one language alone, or undefined when that language lacks it. */
function own(lang: Lang, key: TextKey): string | undefined {
  const i = (CORE_LANGS as readonly string[]).indexOf(lang);
  if (i >= 0) return (ROWS[key] as readonly string[])[i];
  return LOCALES[lang]?.[key];
}

/** The text of a key: the language, then its main language, then English, then Spanish. */
export function text(lang: Lang, key: TextKey, vars?: Record<string, string | number>): string {
  const main = VARIANT_OF[lang];
  let s = own(lang, key) ?? (main ? own(main, key) : undefined) ?? own("en", key) ?? own("es", key) ?? "";
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
