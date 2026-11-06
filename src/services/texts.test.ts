import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CORE_LANGS, LANGS, errorText, text } from "../i18n";
import type { TextKey } from "../i18n";
import { LOCALES } from "../locales";
import { PAGES, pagesFor, parseRoute } from "../model";
import { ROWS } from "../texts";
import { ApiError } from "../api";

const FILES = ["pages/ProjectsPage.tsx", "pages/WorkPage.tsx", "pages/SecurityPage.tsx", "pages/FactoryPage.tsx", "components/FilePreview.tsx", "components/AtcEditor.tsx", "App.tsx"];
const source = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");

/** The keys of the texts that the pages of the services name: `t("key")` and the keys written as a string next to the families (`"pj_..."`). */
function usedKeys(): string[] {
  const found = new Set<string>();
  for (const f of FILES) {
    const s = source(f);
    for (const m of s.matchAll(/\bt\("([a-z_0-9]+)"/g)) found.add(m[1]);
    for (const m of s.matchAll(/"((?:pj|wk|sec|fx|atc|svc|perm)_[a-z_0-9]+)"/g)) found.add(m[1]);
  }
  return [...found];
}

/** The keys the pages build from a word (`fx_sev_${severity}`...): every word they may use. */
const FAMILIES: [string, string[]][] = [
  ["fx_rk_", ["check", "connectivity", "bom", "assembly_bom", "fabpack", "panel"]],
  ["fx_sev_", ["error", "warning", "info"]],
  ["fx_tot_", ["total_batch", "total_board"]],
  ["perm_", ["projects_read", "projects_write", "jobs_start", "jobs_cancel", "machines_manage", "policy_read"]],
  ["wk_note_", ["job_waiting", "job_done", "job_failed"]],
  ["wk_feed_", ["connecting", "live", "reconnecting", "failed"]],
  ["wk_st_", ["queued", "paused"]],
];

describe("the texts of the pages of the common services", () => {
  it("exist for every key the pages name, in the eight languages of the rows", () => {
    const keys = usedKeys();
    expect(keys.length).toBeGreaterThan(100);
    for (const k of keys) {
      // a key that ends in an underscore is the start of a family, written in the code as `fx_sev_${...}`
      if (k.endsWith("_")) continue;
      expect(ROWS, k).toHaveProperty(k);
    }
    for (const [prefix, words] of FAMILIES) for (const w of words) expect(ROWS, prefix + w).toHaveProperty(prefix + w);
    for (const g of ["group_services", "nav_projects", "nav_work", "nav_factory", "nav_security"]) expect(ROWS).toHaveProperty(g);
  });

  it("exist in the 37 languages with the same markers, and the variants fall back to their main language", () => {
    const own = Object.keys(ROWS).filter((k) => /^(pj|wk|sec|fx|atc|svc|perm)_/.test(k) || /^(nav_(projects|work|factory|security)|group_services|act_(refresh|retry|upload|download))$/.test(k));
    expect(own.length).toBeGreaterThan(140);
    const marks = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
    for (const k of own) {
      const english = (ROWS[k as TextKey] as readonly string[])[0];
      for (const lang of LANGS) {
        const s = text(lang, k as TextKey);
        expect(s.trim().length, `${k}/${lang}`).toBeGreaterThan(0);
        expect(marks(s), `${k}/${lang}`).toBe(marks(english));
      }
      for (const lang of Object.keys(LOCALES).filter((l) => !["pt-br", "fr-ca"].includes(l))) expect(LOCALES[lang][k], `${k}/${lang}`).toBeTypeOf("string");
    }
    expect(CORE_LANGS).toHaveLength(8);
  });

  it("say the refusals of the store, the lock and the plugins in every language, with the code of the client too", () => {
    const refusals: [number, string][] = [
      [412, "precondition_failed"],
      [428, "precondition_required"],
      [423, "locked"],
      [413, "file_too_big"],
      [507, "project_quota"],
      [429, "too_many_clients"],
      [404, "unknown_session"],
      [501, "not_supported"],
      [501, "design_run_unavailable"],
      [422, "bad_design_request"],
      [422, "bad_policy"],
      [409, "weak_confirm_required"],
      [0, "download_too_big"],
      [0, "upload_too_big"],
    ];
    for (const [status, code] of refusals) {
      for (const lang of LANGS) {
        const s = errorText(lang, new ApiError(status, code, ""));
        expect(s, `${code}/${lang}`).not.toBe(code);
        expect(s.length).toBeGreaterThan(5);
      }
    }
    // a code that has no sentence says what the server said
    expect(errorText("en", new ApiError(422, "bad_rack", "rack.slots: place 6 is given to two tools"))).toBe("bad_rack: rack.slots: place 6 is given to two tools");
  });
});

describe("the menu of the common services", () => {
  it("adds the pages without taking away the old ones, each with the role it needs", () => {
    const ids = PAGES.map((p) => p.id);
    for (const id of ["overview", "fleet", "jobs", "live", "machines", "access", "server", "updates", "account", "preferences", "about"]) expect(ids).toContain(id);
    const need = (id: string) => PAGES.find((p) => p.id === id);
    for (const id of ["projects", "work", "factory"]) expect(need(id)).toEqual({ id, group: "services", needs: "viewer" });
    expect(need("security")).toEqual({ id: "security", group: "account", needs: "viewer" });
    expect(pagesFor("viewer").map((p) => p.id)).toEqual(expect.arrayContaining(["projects", "work", "factory", "security"]));
  });

  it("reaches a project by the address: the application and the project in the part after the page", () => {
    expect(parseRoute("#/projects")).toEqual({ page: "projects", param: "" });
    expect(parseRoute("#/projects/pcb/p-1")).toEqual({ page: "projects", param: "pcb/p-1" });
    expect(parseRoute("#/work/atc")).toEqual({ page: "work", param: "atc" });
  });

  it("loads the pages of the services when they are first opened, not with the first screen", () => {
    const app = source("App.tsx");
    for (const page of ["ProjectsPage", "WorkPage", "FactoryPage", "SecurityPage"]) {
      expect(app).toContain(`lazy(() => import("./pages/${page}")`);
      expect(app).not.toMatch(new RegExp(`^import .*from "./pages/${page}"`, "m"));
    }
    expect(app).toContain("<Suspense");
  });

  it("keeps the token where Studio already kept it, and writes none in the code of the services", () => {
    for (const f of ["services/http.ts", "services/context.tsx", "services/store.ts", "services/events.ts", "services/work.ts", "services/authsvc.ts"]) {
      expect(source(f), f).not.toMatch(/localStorage|sessionStorage|document\.cookie/);
    }
  });
});
