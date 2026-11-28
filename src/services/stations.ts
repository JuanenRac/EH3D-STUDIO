/*
 * The pages of the plugins `pcb`, `laser` and `cad` of EH3D-SERVER (docs/MACHINE_PLUGINS.md): the example requests a person starts from and the reading of the report a job brings in
 * its `view`. All three plugins are simulators. GPL-3.0-or-later.
 */

export const STATION_PLUGINS = ["pcb", "laser", "cad"] as const;
export type StationPlugin = (typeof STATION_PLUGINS)[number];

export interface Example {
  kind: string;
  request: Record<string, unknown>;
}

const BOARD = {
  outline: { width_mm: 100, height_mm: 80 },
  tracks: [{ width_mm: 0.25 }],
  clearances: [{ gap_mm: 0.2 }],
  drills: [{ dia_mm: 0.8, x: 10, y: 10 }],
};

const CAD_PROJECT = {
  schema: "eh3d.cad.project/1",
  units: "mm",
  sketches: [{ id: "s1" }],
  features: [{ id: "f1", kind: "extrude", sketch: "s1" }],
  parts: [{ id: "p1", name: "Part", features: ["f1"] }],
};

/** One small request of each kind a plugin takes. Nothing here is sent by itself: it only fills the form of the queue. */
export const EXAMPLES: Record<StationPlugin, readonly Example[]> = {
  pcb: [
    { kind: "rules_check", request: { kind: "rules_check", board: BOARD } },
    { kind: "drill_report", request: { kind: "drill_report", board: { drills: BOARD.drills } } },
    { kind: "bom_report", request: { kind: "bom_report", components: [{ ref: "R1", value: "10k", footprint: "0603" }] } },
    { kind: "inspect", request: { kind: "inspect", measurements: [{ name: "width", nominal: 100, tolerance: 0.2, value: 100.1 }] } },
  ],
  laser: [
    { kind: "vector", request: { kind: "vector", paths: [{ layer: "cut", points: [[10, 10], [30, 10], [30, 30]], closed: true }], operations: [{ layer: "cut", mode: "cut", power_pct: 10, speed: 600, passes: 1 }] } },
    { kind: "gcode", request: { kind: "gcode", text: "G21\nG90\nM4 S0\nG1 X10 Y10 F600 S100\nM5\n" } },
    { kind: "test_fire", request: { kind: "test_fire", power_pct: 1, seconds: 0.5 } },
  ],
  cad: [
    { kind: "check", request: { kind: "check", project: CAD_PROJECT } },
    { kind: "report", request: { kind: "report", project: CAD_PROJECT } },
  ],
};

export interface Issue {
  severity: string;
  code: string;
  item: string;
  message: string;
}

export interface Report {
  /** `pass`, `fail` or null for a job that gives no verdict. */
  verdict: string | null;
  facts: { key: string; value: string }[];
  issues: Issue[];
}

const MOST_ISSUES = 500;

function object(x: unknown): Record<string, unknown> | null {
  return typeof x === "object" && x !== null && !Array.isArray(x) ? (x as Record<string, unknown>) : null;
}

function text(x: unknown): string {
  return typeof x === "string" ? x : typeof x === "number" || typeof x === "boolean" ? String(x) : "";
}

/** Reads what the `view` of a job says. A view of a shape nobody expected gives what can be read of it, never an error. */
export function readReport(view: unknown): Report {
  const top = object(view);
  const report: Report = { verdict: null, facts: [], issues: [] };
  if (!top) return report;
  const result = object(top.result);
  const check = object(result?.check);
  const places = [top, result, check].filter((x): x is Record<string, unknown> => x !== null);
  for (const place of places) {
    if (report.verdict === null && typeof place.verdict === "string") report.verdict = place.verdict;
    for (const [key, value] of Object.entries(place)) {
      const shown = text(value);
      if (key !== "verdict" && shown !== "" && shown.length <= 200 && !report.facts.some((f) => f.key === key)) report.facts.push({ key, value: shown });
    }
    if (report.issues.length === 0 && Array.isArray(place.issues)) {
      for (const raw of place.issues.slice(0, MOST_ISSUES)) {
        const i = object(raw);
        if (!i) continue;
        const numbers = [text(i.value), text(i.limit)].filter((v) => v !== "").join(" / ");
        report.issues.push({
          severity: text(i.severity),
          code: text(i.code) || text(i.kind),
          item: text(i.id) || text(i.item) || text(i.ref) || text(i.name),
          message: text(i.message) || numbers,
        });
      }
    }
  }
  return report;
}

/** Whether the request already typed is for one of the kinds a machine takes: picking the machine then leaves it as it is. */
export function keepRequest(typed: string, kinds: readonly string[]): boolean {
  try {
    const kind = object(JSON.parse(typed))?.kind;
    return typeof kind === "string" && kinds.includes(kind) && typed.trim() !== "";
  } catch {
    return false;
  }
}
