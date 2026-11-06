import { describe, expect, it } from "vitest";
import {
  DESIGN_KINDS,
  DESIGN_RUN_AVAILABLE,
  RUN_POLL_MAX,
  RUN_POLL_S,
  SEVERITIES,
  SEVERITY_MARK,
  boardCandidates,
  classifyReport,
  coordinates,
  countBySeverity,
  designRequest,
  filterFindings,
  locations,
  nmToMm,
  parseReportText,
  reportCandidates,
  unwrapRun,
} from "./design";
import type { Finding } from "./design";

// the shapes below are the output of `phoenix check --json`, `bom --json-file`, `fabpack` (manifest.json), the assembly bill and `panel --json`
const CHECK = {
  schema: "phoenix-check/1",
  passes: false,
  confirmed: [
    { rank: 5, rule: "copper_clearance", code: "PHOENIX-DRC-001", severity: "error", location: "track x", at_nm: [1500000, 2500000], measured_nm: 100000, limit_nm: 200000, detail: "" },
    { rank: 9, rule: "silk", code: "PHOENIX-DRC-009", severity: "warning", location: "R1", at_nm: null, measured_nm: null, limit_nm: null, detail: "over a pad" },
    { rank: 9, rule: "silk", code: "PHOENIX-DRC-009", severity: "warning", location: "R1", at_nm: null, measured_nm: null, limit_nm: null, detail: "again" },
  ],
  inconclusive: [{ rank: 13, rule: "not_judged", code: "PHOENIX-DRC-099", severity: "info", location: "track y", at_nm: null, measured_nm: null, limit_nm: null, detail: "arc" }],
};

const BOM = {
  format: "phoenix-bom/1",
  currency: "EUR",
  boards: 10,
  waste_percent: "5.000000",
  complete: false,
  lines: [
    { references: ["R1", "R2"], quantity: 2, value: "10k", footprint: "0603", manufacturer: "Yageo", mpn: "RC0603", quantity_needed: 20, status: "ok", offer: { supplier: "Mouser", unit_price: "0.010000", cost_batch: "0.210000" } },
    { references: ["U1"], quantity: 1, value: "MCU", footprint: "QFN32", manufacturer: "", mpn: "", status: "no_offer", offer: null },
  ],
  parts: { batch: "10.5", per_board: "1.05" },
  pcb: null,
  total: { batch: "20.5", per_board: "2.05" },
  findings: [{ code: "PHOENIX-BOM-002", severity: "warning", subject: "U1", detail: "no price" }],
};

describe("what is a report", () => {
  it("reads the output of the rule check with the positions in millimetres", () => {
    const r = classifyReport(CHECK);
    expect(r?.kind).toBe("check");
    if (r?.kind !== "check") return;
    expect(r.passes).toBe(false);
    expect(r.confirmed).toHaveLength(3);
    expect(r.confirmed[0]).toMatchObject({ code: "PHOENIX-DRC-001", severity: "error", location: "track x", atMm: [1.5, 2.5], measuredMm: 0.1, limitMm: 0.2 });
    expect(r.confirmed[1].atMm).toBeUndefined();
    expect(r.inconclusive[0].severity).toBe("info");
    expect(classifyReport({ ...CHECK, schema: "phoenix-connectivity/1" })?.kind).toBe("connectivity");
  });

  it("reads the bill of materials with its offers, totals and findings", () => {
    const r = classifyReport(BOM);
    expect(r?.kind).toBe("bom");
    if (r?.kind !== "bom") return;
    expect(r.currency).toBe("EUR");
    expect(r.complete).toBe(false);
    expect(r.lines[0]).toMatchObject({ references: ["R1", "R2"], quantity: 2, supplier: "Mouser", costBatch: "0.210000" });
    expect(r.lines[1].supplier).toBe("");
    expect(r.totals).toEqual([
      ["total_batch", "20.5"],
      ["total_board", "2.05"],
    ]);
    expect(r.findings[0]).toMatchObject({ location: "U1", severity: "warning" });
  });

  it("reads the bill of the assembly, the manifest of the fabrication package and the summary of the panel", () => {
    const asm = classifyReport({ format: "phoenix-assembly-bom/1", boards_per_panel: 4, faces: [{ face: "top", parts_board: 12, parts_panel: 48, lines: [1, 2], not_fitted: [], findings: [] }] });
    expect(asm).toMatchObject({ kind: "assembly_bom", boardsPerPanel: 4 });
    const fab = classifyReport({ format: "phoenix-fab-package/1", board: "demo", profile: "generic", units: "mm", files: [{ bytes: 10, path: "bom/bom_top.csv", sha256: "ab" }], notes: ["prototype"] });
    expect(fab).toMatchObject({ kind: "fabpack", board: "demo", files: [{ path: "bom/bom_top.csv", bytes: 10, sha256: "ab" }], notes: ["prototype"] });
    const panel = classifyReport({ width_nm: 100000000, height_nm: 60000000, columns: 2, rows: 1, joint: "v_score", copies: [{}, {}], utilisation_permille: 735, files: ["a.gbr"], notes: [{ code: "N1", detail: "d" }] });
    expect(panel).toMatchObject({ kind: "panel", columns: 2, rows: 1, widthMm: 100, heightMm: 60, copies: 2, utilisationPercent: 74, files: ["a.gbr"] });
  });

  it("leaves a JSON that is not a report as a plain file, and does not break on odd values", () => {
    expect(classifyReport({ hello: "world" })).toBeNull();
    expect(classifyReport([1, 2])).toBeNull();
    expect(classifyReport(null)).toBeNull();
    expect(classifyReport("text")).toBeNull();
    expect(parseReportText("{broken")).toBeNull();
    expect(parseReportText(JSON.stringify(CHECK))?.kind).toBe("check");
    const odd = classifyReport({ schema: "phoenix-check/1", confirmed: [{ severity: "catastrophic", at_nm: ["x", 1] }, 5, null], inconclusive: "no" });
    expect(odd?.kind).toBe("check");
    if (odd?.kind === "check") {
      expect(odd.confirmed).toHaveLength(1);
      expect(odd.confirmed[0].severity).toBe("info");
      expect(odd.confirmed[0].atMm).toBeUndefined();
      expect(odd.inconclusive).toEqual([]);
      expect(odd.passes).toBe(false);
    }
  });

  it("picks the JSON files that may be reports, the likely names first, with a size and a number limit", () => {
    const files = [
      { name: "notes.json", size: 10 },
      { name: "reports/check.json", size: 20 },
      { name: "huge.json", size: 50 * 1024 * 1024 },
      { name: "board.brd", size: 5 },
      { name: "fab/manifest.json", size: 30 },
      { name: "A.JSON", size: 1 },
    ];
    expect(reportCandidates(files)).toEqual(["fab/manifest.json", "reports/check.json", "A.JSON", "notes.json"]);
    expect(reportCandidates(files, 2)).toHaveLength(2);
  });
});

describe("the findings on the page", () => {
  const r = classifyReport(CHECK);
  const findings: Finding[] = r?.kind === "check" ? [...r.confirmed, ...r.inconclusive] : [];

  it("count by severity and give each severity a mark so the colour is never alone", () => {
    expect(countBySeverity(findings)).toEqual({ error: 1, warning: 2, info: 1 });
    for (const s of SEVERITIES) expect(SEVERITY_MARK[s].length).toBeGreaterThan(0);
    expect(new Set(SEVERITIES.map((s) => SEVERITY_MARK[s])).size).toBe(3);
  });

  it("filter by severity, by words in the code, the place or the detail, and by the exact place followed", () => {
    const f = { severity: "" as const, text: "", location: "" };
    expect(filterFindings(findings, f)).toHaveLength(4);
    expect(filterFindings(findings, { ...f, severity: "warning" })).toHaveLength(2);
    expect(filterFindings(findings, { ...f, text: "again pad" })).toEqual([]);
    expect(filterFindings(findings, { ...f, text: "OVER pad" })).toHaveLength(1);
    expect(filterFindings(findings, { ...f, text: "drc-001" })).toHaveLength(1);
    expect(filterFindings(findings, { ...f, location: "R1" })).toHaveLength(2);
  });

  it("list the places with how many findings each has, and give the position to copy", () => {
    expect(locations(findings)).toEqual([
      { location: "R1", count: 2 },
      { location: "track x", count: 1 },
      { location: "track y", count: 1 },
    ]);
    expect(coordinates(findings[0])).toBe("1.5, 2.5");
    expect(coordinates(findings[1])).toBeNull();
    expect(nmToMm(1234567)).toBe(1.235);
  });
});

describe("running the checks on the server", () => {
  it("is offered, and the request that runs them is built only when it is complete", () => {
    expect(DESIGN_RUN_AVAILABLE).toBe(true);
    expect(DESIGN_KINDS).toEqual(["check", "bom", "fabpack", "panel"]);
    expect(designRequest("check", "p-1", "board.brd")).toEqual({ kind: "check", project: "p-1", file: "board.brd", options: {} });
    expect(designRequest("bom", "", "board.brd")).toBeNull();
    expect(designRequest("panel", "p-1", "")).toBeNull();
  });

  it("reads the report a run of the server kept: the JSON of the program is taken out of the envelope", () => {
    const envelope = { kind: "check", file: "board.json", ok: false, exit_code: 1, timed_out: false, truncated: false, report: CHECK, text: null, stderr: "" };
    expect(unwrapRun(envelope)).toBe(CHECK);
    expect(parseReportText(JSON.stringify(envelope))?.kind).toBe("check");
    // a dry run of fabpack has only text, which is not a report; a JSON that is not an envelope is left as it is
    expect(parseReportText(JSON.stringify({ ...envelope, kind: "fabpack", report: null, text: "dry run" }))).toBeNull();
    expect(unwrapRun(CHECK)).toBe(CHECK);
    expect(unwrapRun(null)).toBeNull();
  });

  it("offers the files of a project that can be worked on, the boards first, and never the reports a run left", () => {
    const files = [{ name: "reports/check.json" }, { name: "notes.txt" }, { name: "main.kicad_pcb" }, { name: "panel/readme.md" }, { name: "a.json" }];
    expect(boardCandidates(files)).toEqual(["a.json", "main.kicad_pcb", "notes.txt", "panel/readme.md"]);
    expect(boardCandidates([{ name: "reports/bom.json" }])).toEqual([]);
    expect(boardCandidates([])).toEqual([]);
  });

  it("waits a second between two reads of the job and gives up after a few minutes", () => {
    expect(RUN_POLL_S).toBe(1);
    expect(RUN_POLL_MAX * RUN_POLL_S).toBeGreaterThanOrEqual(120);
    expect(RUN_POLL_MAX * RUN_POLL_S).toBeLessThanOrEqual(600);
  });
});
