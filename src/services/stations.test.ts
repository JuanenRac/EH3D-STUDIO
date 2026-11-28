import { describe, expect, it } from "vitest";
import { EXAMPLES, STATION_PLUGINS, keepRequest, readReport } from "./stations";

describe("the pages of the pcb, laser and cad plugins", () => {
  it("has an example for each kind of each plugin and each says its own kind", () => {
    expect(STATION_PLUGINS.map((p) => EXAMPLES[p].map((e) => e.kind))).toEqual([
      ["rules_check", "drill_report", "bom_report", "inspect"],
      ["vector", "gcode", "test_fire"],
      ["check", "report"],
    ]);
    for (const p of STATION_PLUGINS) for (const e of EXAMPLES[p]) expect(e.request.kind).toBe(e.kind);
  });

  it("reads the verdict and the issues of a board report", () => {
    const r = readReport({ kind: "rules_check", verdict: "fail", errors: 1, issues: [{ severity: "error", code: "track_width", item: "tracks 1", value: 0.1, limit: 0.15 }] });
    expect(r.verdict).toBe("fail");
    expect(r.facts).toContainEqual({ key: "errors", value: "1" });
    expect(r.issues).toEqual([{ severity: "error", code: "track_width", item: "tracks 1", message: "0.1 / 0.15" }]);
  });

  it("finds the issues of a CAD report inside its check", () => {
    const r = readReport({ kind: "report", verdict: "pass", result: { parts: 2, check: { verdict: "pass", issues: [{ severity: "warning", code: "empty_part", id: "p2", message: "no features" }] } } });
    expect(r.verdict).toBe("pass");
    expect(r.facts).toContainEqual({ key: "parts", value: "2" });
    expect(r.issues[0]).toEqual({ severity: "warning", code: "empty_part", item: "p2", message: "no features" });
  });

  it("gives nothing and no error for a view of another shape", () => {
    for (const view of [null, undefined, 3, "text", [], { issues: "no" }, { issues: [1, null] }]) {
      expect(readReport(view).issues).toEqual([]);
    }
  });

  it("keeps a typed request only for a machine that takes its kind", () => {
    expect(keepRequest('{"kind":"check","project":{}}', ["check", "report"])).toBe(true);
    expect(keepRequest('{"kind":"demo","steps":10}', ["check"])).toBe(false);
    expect(keepRequest("{", ["check"])).toBe(false);
    expect(keepRequest("{}", ["check"])).toBe(false);
  });
});
