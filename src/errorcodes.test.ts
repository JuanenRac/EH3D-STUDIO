import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LANGS, errorText, text } from "./i18n";
import type { TextKey } from "./i18n";
import { ROWS } from "./texts";
import { ApiError } from "./api";

/** The codes of the server that the pages meet when a machine, a project, a catalog or the inspection of the drill head refuses a request. */
const MACHINE_AND_STORE_CODES = [
  "bad_app", "bad_board", "bad_catalog", "bad_container", "bad_dcf", "bad_hole", "bad_ncd", "bad_path", "bad_picture", "bad_plugin_request", "bad_profile", "bad_samples", "bad_sorting",
  "bad_tool", "both_sources", "catalog_readonly", "no_hole", "not_locked", "plugin_failed", "too_many_holes", "unknown_catalog", "unknown_file", "unknown_item", "unknown_plugin",
  "unknown_tool", "unknown_version",
];

describe("the refusals of the server", () => {
  it("have a text in the eight languages for the codes of machines, projects, catalogs and the inspection", () => {
    for (const code of MACHINE_AND_STORE_CODES) {
      const key = `err_${code}`;
      expect(ROWS, key).toHaveProperty(key);
      expect((ROWS[key as TextKey] as readonly string[]).length, key).toBe(8);
      for (const lang of LANGS) {
        expect(text(lang, key as TextKey).trim().length, `${key}/${lang}`).toBeGreaterThan(0);
        expect(errorText(lang, new ApiError(422, code, "")), `${key}/${lang}`).not.toBe(code);
      }
    }
  });

  it("have a text for every code of the catalog of the server when its repository is next to this one", () => {
    const file = new URL("../../EH3D-SERVER/docs/error-codes.json", import.meta.url);
    if (!existsSync(file)) return; // a checkout of this repository alone has no sibling: nothing to compare with
    const codes = (JSON.parse(readFileSync(file, "utf8")) as { code: string }[]).map((c) => c.code);
    expect(codes.length).toBeGreaterThan(100);
    // Codes that are about the transport or that the pages never show as such keep the plain `code: detail` line.
    const exempt = new Set<string>();
    const missing = codes.filter((c) => !exempt.has(c) && !(`err_${c}` in ROWS));
    expect(missing).toEqual([]);
  });
});
