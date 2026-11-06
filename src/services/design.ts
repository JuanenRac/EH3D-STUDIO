/*
 * The reports of the design tools (EH3D-PHOENIX-PCB: `phoenix check`, `connectivity`, `bom`, `fabpack` and `panel` with their JSON output) read from the files of a project of
 * the store, and the request that would run them on the server. A file is a report when its JSON has the shape of one of them; anything else stays a plain file. Nothing is
 * assumed that the file does not say: a field that is missing is left out of the page, a number that is not a number is not shown. GPL-3.0-or-later.
 */

export type Severity = "error" | "warning" | "info";
export const SEVERITIES: Severity[] = ["error", "warning", "info"];

/** The mark that goes with the colour of a severity, so the colour is never the only thing that says it. */
export const SEVERITY_MARK: Record<Severity, string> = { error: "✖", warning: "▲", info: "●" };

export interface Finding {
  code: string;
  severity: Severity;
  location: string;
  detail: string;
  /** Where on the board, in millimetres (x, y), when the finding says. */
  atMm?: [number, number];
  measuredMm?: number;
  limitMm?: number;
  rule?: string;
}

export interface BomLine {
  references: string[];
  quantity: number;
  value: string;
  footprint: string;
  manufacturer: string;
  mpn: string;
  status: string;
  supplier: string;
  unitPrice: string;
  costBatch: string;
}

export interface AssemblyFace {
  face: string;
  partsBoard: number;
  partsPanel: number;
  lines: number;
  notFitted: number;
  findings: Finding[];
}

export interface FabFile {
  path: string;
  bytes: number;
  sha256: string;
}

export type Report =
  | { kind: "check" | "connectivity"; passes: boolean; confirmed: Finding[]; inconclusive: Finding[] }
  | { kind: "bom"; currency: string; boards: number; wastePercent: string; complete: boolean; lines: BomLine[]; totals: [string, string][]; findings: Finding[] }
  | { kind: "assembly_bom"; boardsPerPanel: number; faces: AssemblyFace[] }
  | { kind: "fabpack"; board: string; profile: string; units: string; files: FabFile[]; notes: string[] }
  | { kind: "panel"; columns: number; rows: number; widthMm: number; heightMm: number; joint: string; copies: number; utilisationPercent: number; holes: [string, number][]; files: string[]; notes: { code: string; detail: string }[] };

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown): string {
  return typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
}
function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
function list(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

/** Nanometres (what the reports of PHOENIX measure in) as millimetres, to three places. */
export function nmToMm(nm: number): number {
  return Math.round(nm / 1000) / 1000;
}

function severityOf(v: unknown): Severity {
  return v === "error" || v === "warning" || v === "info" ? v : "info";
}

function readFinding(v: unknown): Finding | null {
  if (!isObj(v)) return null;
  const f: Finding = { code: str(v.code), severity: severityOf(v.severity), location: str(v.location) || str(v.subject), detail: str(v.detail) };
  if (str(v.rule)) f.rule = str(v.rule);
  const at = v.at_nm;
  if (Array.isArray(at) && at.length === 2 && num(at[0]) !== undefined && num(at[1]) !== undefined) f.atMm = [nmToMm(at[0] as number), nmToMm(at[1] as number)];
  const measured = num(v.measured_nm);
  if (measured !== undefined) f.measuredMm = nmToMm(measured);
  const limit = num(v.limit_nm);
  if (limit !== undefined) f.limitMm = nmToMm(limit);
  return f;
}

function findings(v: unknown): Finding[] {
  return list(v).map(readFinding).filter((f): f is Finding => f !== null);
}

/** What a JSON value is, if it is the output of one of the design commands; null when it is not (a plain file). */
export function classifyReport(json: unknown): Report | null {
  if (!isObj(json)) return null;
  const schema = str(json.schema);
  const format = str(json.format);
  if (schema === "phoenix-check/1" || schema === "phoenix-connectivity/1") {
    return {
      kind: schema === "phoenix-check/1" ? "check" : "connectivity",
      passes: json.passes === true,
      confirmed: findings(json.confirmed),
      inconclusive: findings(json.inconclusive),
    };
  }
  if (format === "phoenix-bom/1") {
    const lines: BomLine[] = list(json.lines).filter(isObj).map((l) => {
      const offer = isObj(l.offer) ? l.offer : {};
      const refs = Array.isArray(l.references) ? l.references.map(str).filter(Boolean) : str(l.references) ? [str(l.references)] : [];
      return {
        references: refs,
        quantity: num(l.quantity) ?? refs.length,
        value: str(l.value),
        footprint: str(l.footprint),
        manufacturer: str(l.manufacturer),
        mpn: str(l.mpn),
        status: str(l.status),
        supplier: str(offer.supplier),
        unitPrice: str(offer.unit_price),
        costBatch: str(offer.cost_batch),
      };
    });
    const total = isObj(json.total) ? json.total : {};
    const totals: [string, string][] = [];
    if (str(total.batch)) totals.push(["total_batch", str(total.batch)]);
    if (str(total.per_board)) totals.push(["total_board", str(total.per_board)]);
    return {
      kind: "bom",
      currency: str(json.currency),
      boards: num(json.boards) ?? 0,
      wastePercent: str(json.waste_percent),
      complete: json.complete === true,
      lines,
      totals,
      findings: findings(json.findings),
    };
  }
  if (format === "phoenix-assembly-bom/1") {
    return {
      kind: "assembly_bom",
      boardsPerPanel: num(json.boards_per_panel) ?? 1,
      faces: list(json.faces).filter(isObj).map((f) => ({
        face: str(f.face),
        partsBoard: num(f.parts_board) ?? 0,
        partsPanel: num(f.parts_panel) ?? 0,
        lines: list(f.lines).length,
        notFitted: list(f.not_fitted).length,
        findings: findings(f.findings),
      })),
    };
  }
  if (format === "phoenix-fab-package/1") {
    return {
      kind: "fabpack",
      board: str(json.board),
      profile: str(json.profile),
      units: str(json.units),
      files: list(json.files).filter(isObj).map((f) => ({ path: str(f.path), bytes: num(f.bytes) ?? 0, sha256: str(f.sha256) })),
      notes: list(json.notes).map(str).filter(Boolean),
    };
  }
  if (num(json.columns) !== undefined && num(json.rows) !== undefined && Array.isArray(json.copies)) {
    const holes: [string, number][] = [];
    if (isObj(json.holes)) for (const [k, v] of Object.entries(json.holes)) if (typeof v === "number") holes.push([k, v]);
    return {
      kind: "panel",
      columns: num(json.columns) ?? 0,
      rows: num(json.rows) ?? 0,
      widthMm: nmToMm(num(json.width_nm) ?? 0),
      heightMm: nmToMm(num(json.height_nm) ?? 0),
      joint: str(json.joint),
      copies: list(json.copies).length,
      utilisationPercent: Math.round((num(json.utilisation_permille) ?? 0) / 10),
      holes,
      files: list(json.files).map(str).filter(Boolean),
      notes: list(json.notes).filter(isObj).map((n) => ({ code: str(n.code), detail: str(n.detail) })),
    };
  }
  return null;
}

/** The report in a text, or null when the text is not JSON or is not a report. */
export function parseReportText(text: string): Report | null {
  try {
    return classifyReport(JSON.parse(text));
  } catch {
    return null;
  }
}

/** The files of a project that may be reports: JSON files not over the limit, the most likely names first, and no more than `max` of them. */
export function reportCandidates(files: readonly { name: string; size: number }[], max = 12, maxBytes = 2 * 1024 * 1024): string[] {
  const likely = (n: string) => /(check|drc|erc|connectivity|bom|fab|manifest|panel|report)/i.test(n);
  return files
    .filter((f) => f.name.toLowerCase().endsWith(".json") && f.size <= maxBytes)
    .sort((a, b) => Number(likely(b.name)) - Number(likely(a.name)) || a.name.localeCompare(b.name))
    .slice(0, max)
    .map((f) => f.name);
}

export function countBySeverity(list: readonly Finding[]): Record<Severity, number> {
  const out: Record<Severity, number> = { error: 0, warning: 0, info: 0 };
  for (const f of list) out[f.severity] += 1;
  return out;
}

export interface FindingFilter {
  severity: Severity | "";
  text: string;
  location: string;
}

/** The findings that match: the severity, the words (in the code, the place or the detail) and the exact place a person chose to follow. */
export function filterFindings(list: readonly Finding[], f: FindingFilter): Finding[] {
  const words = f.text.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((x) => {
    if (f.severity && x.severity !== f.severity) return false;
    if (f.location && x.location !== f.location) return false;
    const hay = `${x.code} ${x.location} ${x.detail} ${x.rule ?? ""}`.toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

/** The places the findings are about, with how many each has, the most first. */
export function locations(list: readonly Finding[]): { location: string; count: number }[] {
  const n = new Map<string, number>();
  for (const f of list) if (f.location) n.set(f.location, (n.get(f.location) ?? 0) + 1);
  return [...n.entries()].map(([location, count]) => ({ location, count })).sort((a, b) => b.count - a.count || a.location.localeCompare(b.location));
}

/** The place of a finding for the clipboard (`x, y` in millimetres), or null when it has none. */
export function coordinates(f: Finding): string | null {
  return f.atMm ? `${f.atMm[0]}, ${f.atMm[1]}` : null;
}

// ---- the request that would run a check on the server (not available on this server yet)

export type DesignKind = "check" | "bom" | "fabpack" | "panel";
export const DESIGN_KINDS: DesignKind[] = ["check", "bom", "fabpack", "panel"];

/** The server does not run PHOENIX-PCB or CAM yet (docs/DESIGN_FACTORY_CONTRACT_NEEDS.md names the routes it would need), so the page keeps its buttons off. */
export const DESIGN_RUN_AVAILABLE = false;

export interface DesignRequest {
  kind: DesignKind;
  project: string;
  /** The file of the project to work on (the board). */
  file: string;
  options: Record<string, string | number | boolean>;
}

/** The body of the proposed `POST /api/v1/apps/pcb/jobs`; null when the project or the file is missing. */
export function designRequest(kind: DesignKind, project: string, file: string, options: DesignRequest["options"] = {}): DesignRequest | null {
  if (!project || !file || !DESIGN_KINDS.includes(kind)) return null;
  return { kind, project, file, options };
}
