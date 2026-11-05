/* More tests: the rules of the title and the alert, the page that asks again, the copy to the clipboard, the languages and the texts in each of them, and the sentences of the errors. */
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { shouldAlert, titleFor } from "./attention";
import { copyWithSelection } from "./clipboard";
import { CORE_LANGS, LANGS, LANG_NAMES, VARIANT_OF, browserLang, errorText, isLang, text } from "./i18n";
import type { TextKey } from "./i18n";
import { skipWhileBusy } from "./polling";
import { ROWS } from "./texts";

const KEYS = Object.keys(ROWS) as TextKey[];

describe("the alert and the title of the page", () => {
  it("alerts only when more jobs wait than before", () => {
    expect(shouldAlert(0, 1)).toBe(true);
    expect(shouldAlert(1, 3)).toBe(true);
    expect(shouldAlert(2, 2)).toBe(false);
    expect(shouldAlert(3, 1)).toBe(false);
    expect(shouldAlert(0, 0)).toBe(false);
  });

  it("counts the jobs that wait in the title and goes back to the plain one", () => {
    expect(titleFor(0)).toBe("EH3D Studio");
    expect(titleFor(1)).toBe("(1) EH3D Studio");
    expect(titleFor(12)).toBe("(12) EH3D Studio");
    expect(titleFor(-1)).toBe("EH3D Studio");
  });
});

describe("a page that asks again every few seconds", () => {
  it("does not start a request while the last one is in flight and starts again when it ends", async () => {
    let finish: () => void = () => {};
    const run = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const poll = skipWhileBusy(run);
    expect(poll()).toBe(true);
    expect(poll()).toBe(false);
    expect(poll()).toBe(false);
    expect(run).toHaveBeenCalledTimes(1);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(poll()).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("starts again after a request that failed, and never throws to the caller", async () => {
    const run = vi.fn(() => Promise.reject(new Error("down")));
    const poll = skipWhileBusy(run);
    expect(poll()).toBe(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(poll()).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("keeps the state of each wrapped function apart", () => {
    const never = () => new Promise<void>(() => {});
    const a = skipWhileBusy(never);
    const b = skipWhileBusy(never);
    expect(a()).toBe(true);
    expect(b()).toBe(true);
    expect(a()).toBe(false);
  });
});

describe("the copy to the clipboard with the old way", () => {
  function fakeDocument(result: boolean | "throws") {
    const box: Record<string, unknown> = { style: {}, attributes: {} };
    const removed: unknown[] = [];
    const doc = {
      body: {
        appendChild: vi.fn(),
        removeChild: (n: unknown) => removed.push(n),
      },
      activeElement: { focus: vi.fn() },
      createElement: () => {
        Object.assign(box, {
          setAttribute: (k: string, v: string) => ((box.attributes as Record<string, string>)[k] = v),
          focus: vi.fn(),
          select: vi.fn(),
          setSelectionRange: vi.fn(),
        });
        return box;
      },
      execCommand: (c: string) => {
        expect(c).toBe("copy");
        if (result === "throws") throw new Error("not allowed");
        return result;
      },
    };
    return { doc: doc as unknown as Document, box, removed };
  }

  it("copies, and takes the hidden box away and gives the focus back", () => {
    const { doc, box, removed } = fakeDocument(true);
    expect(copyWithSelection("hello", doc)).toBe(true);
    expect(box.value).toBe("hello");
    expect(removed).toEqual([box]);
    expect((doc.activeElement as unknown as { focus: ReturnType<typeof vi.fn> }).focus).toHaveBeenCalled();
    expect((box.attributes as Record<string, string>).readonly).toBe("");
  });

  it("says no when the browser refuses, and also when the command throws, and still cleans up", () => {
    const refused = fakeDocument(false);
    expect(copyWithSelection("x", refused.doc)).toBe(false);
    expect(refused.removed).toEqual([refused.box]);
    const thrown = fakeDocument("throws");
    expect(copyWithSelection("x", thrown.doc)).toBe(false);
    expect(thrown.removed).toEqual([thrown.box]);
  });

  it("says no without a document or without a body", () => {
    expect(copyWithSelection("x", undefined)).toBe(false);
    expect(copyWithSelection("x", { body: null } as unknown as Document)).toBe(false);
  });
});

describe("the languages", () => {
  it("are 37, with the names of each in itself and the Portuguese of Portugal", () => {
    expect(LANGS).toHaveLength(37);
    expect(new Set(LANGS).size).toBe(37);
    expect(LANGS.slice(0, 8)).toEqual(["en", "es", "it", "de", "fr", "pt", "zh", "ja"]);
    expect(Object.keys(VARIANT_OF)).toEqual(["pt-br", "fr-ca"]);
    for (const l of LANGS) expect(LANG_NAMES[l].trim().length).toBeGreaterThan(0);
    expect(LANG_NAMES.pt).toContain("Portugal");
  });

  it("are known by their code only, in lower case", () => {
    for (const l of LANGS) expect(isLang(l)).toBe(true);
    for (const bad of ["", "EN", "pt_br", "xx", "en-US", " en"]) expect(isLang(bad)).toBe(false);
    expect(isLang(null)).toBe(false);
    expect(isLang(undefined)).toBe(false);
  });

  it("are chosen from the list of the browser: the first that is one of the 37, with or without a region", () => {
    expect(browserLang([])).toBe("en");
    expect(browserLang(["xx", "de-AT", "fr"])).toBe("de");
    expect(browserLang(["PT-br"])).toBe("pt-br");
    expect(browserLang(["pt-PT"])).toBe("pt");
    expect(browserLang(["fr-CA"])).toBe("fr-ca");
    expect(browserLang(["fr-BE"])).toBe("fr");
    expect(browserLang(["nb-NO"])).toBe("no");
    expect(browserLang(["nn"])).toBe("no");
    expect(browserLang(["sr-RS", "en"])).toBe("sr");
    expect(browserLang(["ga-IE"])).toBe("ga");
    expect(browserLang(["ko", "th"])).toBe("en");
    expect(browserLang(["zh-Hant-TW"])).toBe("zh");
    expect(browserLang(["ja_JP"])).toBe("ja");
  });
});

describe("the texts in the eight core languages", () => {
  it("have a row of eight for every key and no text is empty or has blanks around it", () => {
    for (const k of KEYS) {
      const row = ROWS[k] as readonly string[];
      expect(row, k).toHaveLength(8);
      for (const [i, s] of row.entries()) {
        expect(s.trim().length, `${k} in ${CORE_LANGS[i]}`).toBeGreaterThan(0);
        expect(s, `${k} in ${CORE_LANGS[i]}`).toBe(s.trim());
        expect(s, `${k} in ${CORE_LANGS[i]}`).not.toMatch(/TODO|FIXME|\?\?\?/);
      }
    }
  });

  it("have the same {names} in every language of a key and balanced braces", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of KEYS) {
      const row = ROWS[k] as readonly string[];
      const reference = names(row[0]);
      for (const [i, s] of row.entries()) {
        expect(names(s), `${k} in ${CORE_LANGS[i]}`).toEqual(reference);
        expect(s.split("{").length, `${k} in ${CORE_LANGS[i]}`).toBe(s.split("}").length);
      }
    }
  });

  it("have the Chinese and the Japanese in their own scripts and the others without them", () => {
    const cjk = /[぀-ヿ一-鿿]/;
    const skip = (k: string) => /^(title|brand)/.test(k);
    for (const k of KEYS) {
      if (skip(k)) continue;
      const row = ROWS[k] as readonly string[];
      const hasCjk = (i: number) => cjk.test(row[i]);
      const plain = row[0].replace(/[^A-Za-z]/g, "").length === 0;
      if (plain) continue;
      for (const code of ["zh", "ja"] as const) expect(hasCjk(CORE_LANGS.indexOf(code)), `${k} in ${code}`).toBe(true);
      for (const code of ["en", "es", "it", "de", "fr", "pt"] as const) expect(hasCjk(CORE_LANGS.indexOf(code)), `${k} in ${code}`).toBe(false);
    }
  });

  it("fill the values given and leave the other markers alone", () => {
    const key = KEYS.find((k) => /\{\w+\}/.test((ROWS[k] as readonly string[])[0]));
    expect(key).toBeDefined();
    const name = /\{(\w+)\}/.exec((ROWS[key as TextKey] as readonly string[])[0])![1];
    for (const l of LANGS) {
      const filled = text(l, key as TextKey, { [name]: "VALUE" });
      expect(filled).toContain("VALUE");
      expect(filled).not.toContain(`{${name}}`);
    }
    // without values the marker stays, and a value that is a number is written as one
    expect(text("en", key as TextKey)).toContain(`{${name}}`);
    expect(text("en", key as TextKey, { [name]: 7 })).toContain("7");
  });
});

describe("the sentences of the errors", () => {
  it("say the error of the server in the language, with its detail except for the network ones", () => {
    const refused = new ApiError(401, "unauthorized", "token expired");
    for (const l of LANGS) expect(errorText(l, refused).length).toBeGreaterThan(0);
    expect(errorText("en", new ApiError(0, "unreachable", "fetch failed"))).toBe(text("en", "err_unreachable"));
    expect(errorText("en", new ApiError(0, "timeout", "15000 ms"))).toBe(text("en", "err_timeout"));
  });

  it("say what the server said when the code is not known, and the message of any other error", () => {
    expect(errorText("es", new ApiError(500, "brand_new_code", "details"))).toBe("brand_new_code: details");
    expect(errorText("es", new ApiError(500, "brand_new_code", ""))).toBe("brand_new_code");
    expect(errorText("de", new Error("plain"))).toBe("plain");
    expect(errorText("de", "a string")).toBe("a string");
    expect(errorText("de", 42)).toBe("42");
  });
});
