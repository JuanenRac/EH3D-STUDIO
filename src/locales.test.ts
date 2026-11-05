import { describe, expect, it } from "vitest";
import { CORE_LANGS, LANGS, LANG_NAMES, VARIANT_OF, text, type Lang, type TextKey } from "./i18n";
import { LOCALES } from "./locales";
import { ROWS } from "./texts";

const KEYS = Object.keys(ROWS) as TextKey[];
const english = (k: TextKey) => (ROWS[k] as readonly string[])[0];
const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const quoted = (s: string) => [...s.matchAll(/`[^`]*`/g)].map((m) => m[0]);
const NEW_LANGS = LANGS.filter((l) => !(CORE_LANGS as readonly string[]).includes(l));
// languages whose file is still the empty one (their texts come from English until they are translated); this list shrinks to nothing
const PENDING: string[] = ["no", "is", "uk", "ru", "sr", "sq", "ca", "gl", "eu"];
const FULL = NEW_LANGS.filter((l) => !(l in VARIANT_OF) && !PENDING.includes(l));
const VARIANTS = NEW_LANGS.filter((l) => l in VARIANT_OF);

describe("the 29 languages added to the eight", () => {
  it("are the files of locales/, one for each language after the eight, in the order of the list", () => {
    expect(NEW_LANGS).toHaveLength(29);
    expect(Object.keys(LOCALES).sort()).toEqual([...NEW_LANGS].sort());
    expect(new Set(Object.values(LANG_NAMES)).size).toBe(37);
    expect(VARIANTS).toEqual(["pt-br", "fr-ca"]);
  });

  it("have an empty file only while they are listed as pending", () => {
    for (const l of PENDING) expect(Object.keys(LOCALES[l]), l).toHaveLength(0);
    for (const l of NEW_LANGS.filter((x) => !PENDING.includes(x) && !(x in VARIANT_OF))) expect(Object.keys(LOCALES[l]).length, l).toBeGreaterThan(0);
  });

  it("have every key of Studio in each full language, with no text empty or with blanks around it", () => {
    for (const l of FULL) {
      const rows = LOCALES[l];
      for (const k of KEYS) {
        expect(rows[k], `${k} in ${l}`).toBeTypeOf("string");
        expect(rows[k].trim().length, `${k} in ${l}`).toBeGreaterThan(0);
        expect(rows[k], `${k} in ${l}`).toBe(rows[k].trim());
        expect(rows[k], `${k} in ${l}`).not.toMatch(/TODO|FIXME|\?\?\?/);
      }
      expect(Object.keys(rows).length, l).toBe(KEYS.length);
    }
  });

  it("have in the variants only keys of Studio, none empty (the rest is taken from the main language)", () => {
    for (const l of VARIANTS) {
      for (const [k, s] of Object.entries(LOCALES[l])) {
        expect(KEYS, `${k} in ${l}`).toContain(k);
        expect(s.trim().length, `${k} in ${l}`).toBeGreaterThan(0);
        expect(s, `${k} in ${l}`).toBe(s.trim());
      }
    }
  });

  it("keep the {markers} and the `code` of the English text exactly, with balanced braces", () => {
    for (const l of NEW_LANGS) {
      for (const [k, s] of Object.entries(LOCALES[l])) {
        const en = english(k as TextKey);
        expect(names(s), `${k} in ${l}`).toEqual(names(en));
        expect(s.split("{").length, `${k} in ${l}`).toBe(s.split("}").length);
        expect(quoted(s), `${k} in ${l}`).toEqual(quoted(en));
      }
    }
  });

  it("are really translated: no language repeats English in more than a tenth of its texts", () => {
    for (const l of FULL) {
      const same = KEYS.filter((k) => LOCALES[l][k] === english(k) && /[A-Za-z]{4}/.test(english(k)));
      expect(same.length / KEYS.length, `${l}: ${same.slice(0, 6).join(", ")}`).toBeLessThan(0.1);
    }
  });

  it("write Bulgarian, Ukrainian, Russian and Serbian in Cyrillic and Greek in Greek", () => {
    const cyrillic = /[Ѐ-ӿ]/;
    const done = (l: string) => !PENDING.includes(l);
    const greek = /[Ͱ-Ͽ]/;
    const wordy = KEYS.filter((k) => english(k).replace(/\{\w+\}|`[^`]*`/g, "").replace(/[^A-Za-z]/g, "").length >= 6);
    for (const l of ["bg", "uk", "ru", "sr"].filter(done)) for (const k of wordy) expect(cyrillic.test(LOCALES[l][k]), `${k} in ${l}`).toBe(true);
    if (done("el")) for (const k of wordy) expect(greek.test(LOCALES.el[k]), `${k} in el`).toBe(true);
    // the other new languages are written in the Latin script
    for (const l of FULL.filter((x) => !["bg", "uk", "ru", "sr", "el"].includes(x))) {
      for (const k of KEYS) expect(cyrillic.test(LOCALES[l][k]) || greek.test(LOCALES[l][k]), `${k} in ${l}`).toBe(false);
    }
  });

  it("are all written from left to right, so Studio needs no right-to-left layout", () => {
    const rtl = new RegExp("[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]");
    for (const l of NEW_LANGS) for (const [k, s] of Object.entries(LOCALES[l])) expect(rtl.test(s), `${k} in ${l}`).toBe(false);
  });

  it("fall back from a variant to its main language, then English, then Spanish", () => {
    const l = "fr-ca" as Lang;
    const missing = KEYS.find((k) => !(k in LOCALES["fr-ca"]))!;
    expect(text(l, missing)).toBe(text("fr", missing));
    const own = Object.keys(LOCALES["pt-br"])[0] as TextKey | undefined;
    if (own) expect(text("pt-br", own)).toBe(LOCALES["pt-br"][own]);
    for (const lang of LANGS) for (const k of KEYS) expect(text(lang, k).length, `${k} in ${lang}`).toBeGreaterThan(0);
  });
});
