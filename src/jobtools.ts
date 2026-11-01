/* What the pages of the jobs decide with: the holes typed by hand, the request of a job, the drawing of a plan, the search and the order of the list, and the
 * CSV of the jobs. Pure functions, tested on their own. GPL-3.0-or-later. */
import type { JobState, JobSummary, JobView } from "./types";

// ---- a job typed by hand

export interface TypedHole {
  tool: number;
  x_mm: number;
  y_mm: number;
}

export interface TypedHoles {
  holes: TypedHole[];
  /** The numbers (1-based) of the lines that could not be read. */
  bad: number[];
}

/** Holes one per line: `tool x y` or `x y` (tool 1), the separators a space, a comma or a semicolon; `#` starts a comment. Millimetres. */
export function parseHoles(text: string): TypedHoles {
  const holes: TypedHole[] = [];
  const bad: number[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.replace(/#.*/, "").trim();
    if (line === "") return;
    const parts = line.split(/[\s,;]+/).filter((p) => p !== "");
    const nums = parts.map(Number);
    if (nums.some((n) => !isFinite(n)) || (parts.length !== 2 && parts.length !== 3)) {
      bad.push(i + 1);
      return;
    }
    const [tool, x, y] = parts.length === 3 ? nums : [1, nums[0], nums[1]];
    if (!Number.isInteger(tool) || tool < 1 || tool > 99) {
      bad.push(i + 1);
      return;
    }
    holes.push({ tool, x_mm: x, y_mm: y });
  });
  return { holes, bad };
}

/** The numbers of the tools a list of holes uses, ascending. */
export function toolsUsed(holes: TypedHole[]): number[] {
  return [...new Set(holes.map((h) => h.tool))].sort((a, b) => a - b);
}

export interface DrillToolInput {
  number: number;
  extra_stroke_mm: number;
  feed_mm_min: number;
  spindle_rpm: number;
}

export function defaultDrillTool(number: number): DrillToolInput {
  return { number, extra_stroke_mm: 0, feed_mm_min: 1000, spindle_rpm: 24000 };
}

export type JobRequest = { kind: "drill" | "route" | "gcode"; name: string } & Record<string, unknown>;

/** The numbers of the tools (or pens) typed as `2, 5 7`: whole numbers from 1 to 99, each once, ascending; `bad` lists the words that were not one. */
export function parseToolList(text: string): { tools: number[]; bad: string[] } {
  const tools: number[] = [];
  const bad: string[] = [];
  for (const word of text.split(/[\s,;]+/).filter((w) => w !== "")) {
    const n = Number(word.replace(/^T/i, ""));
    if (!Number.isInteger(n) || n < 1 || n > 99) bad.push(word);
    else if (!tools.includes(n)) tools.push(n);
  }
  return { tools: tools.sort((a, b) => a - b), bad };
}

/** A drilling or routing request with the tools that are off and the work already done: `skip_tools` and `skip` of the server, left out when they say nothing. */
export function withSkips(r: JobRequest, skipTools: number[], skip: number): JobRequest {
  const out: JobRequest = { ...r };
  if (skipTools.length > 0) out.skip_tools = skipTools;
  if (skip > 0) out.skip = Math.floor(skip);
  return out;
}

/** The request of a free G-code program. `skip` is how many lines of the text are already done (a job that goes on after a stop); `restoreOutputs` starts the spindle and the coolant again when it goes on, and is off unless asked. */
export function gcodeRequest(name: string, gcode: string, skip = 0, restoreOutputs = false): JobRequest {
  const r: JobRequest = { kind: "gcode", name, gcode };
  if (skip > 0) r.skip = Math.floor(skip);
  if (restoreOutputs) r.restore_outputs = true;
  return r;
}

/** How many lines a program text has (the numbering `skip` counts: blank and comment lines too). */
export function gcodeLineCount(text: string): number {
  if (text === "") return 0;
  const n = text.split(/\r?\n/).length;
  return text.endsWith("\n") ? n - 1 : n;
}

// ---- a G-code program kept in the browser, so a job that stopped can go on without picking the file again

const KEPT = "eh3d.gcode.";
const KEPT_MAX = 1_500_000;

/** Keep the text of a program under the id of its job (best effort: a full or blocked store is not an error). */
export function keepProgram(jobId: string, name: string, text: string): void {
  if (text.length > KEPT_MAX) return;
  try {
    window.localStorage.setItem(KEPT + jobId, JSON.stringify({ name, text }));
  } catch {
    /* no store: the person picks the file again */
  }
}

export function keptProgram(jobId: string): { name: string; text: string } | null {
  try {
    const raw = window.localStorage.getItem(KEPT + jobId);
    if (!raw) return null;
    const v = JSON.parse(raw) as { name?: unknown; text?: unknown };
    return typeof v.name === "string" && typeof v.text === "string" ? { name: v.name, text: v.text } : null;
  } catch {
    return null;
  }
}

/** The address of Prepare for a job that goes on: `#/prepare/<machine>/<line>/<job>`; the page reads it back with prepareRoute. */
export function resumeHref(machine: string, line: number, jobId: string): string {
  return `#/prepare/${encodeURIComponent(machine)}/${line}/${encodeURIComponent(jobId)}`;
}

/** The machine, the line to start from and the job whose program was kept, from the part of the address after `prepare/`. */
export function prepareRoute(param: string): { machine: string; skip: number; job: string } {
  const [machine = "", skip = "", job = ""] = param.split("/");
  const n = Number(skip);
  return { machine, skip: Number.isInteger(n) && n > 0 ? n : 0, job };
}

/** The request for a drilling job typed by hand. */
export function drillRequest(name: string, boardMm: number, tools: DrillToolInput[], holes: TypedHole[]): JobRequest {
  return { kind: "drill", name, board_mm: boardMm, tools, holes };
}

export type SourceFiles = Record<string, string>;

/** The request for a job from files: the drilling file `.ncd` and its tool table `.dtd`, or the HP-GL file `.plt` and its tool table `.rtd`. */
export function fileRequest(kind: "drill" | "route", name: string, files: SourceFiles, sorting?: string): JobRequest {
  const r: JobRequest = { kind, name, files };
  if (kind === "drill" && sorting && sorting !== "") r.sorting = sorting;
  return r;
}

/** The slot of a file by its name: `ncd`, `dtd`, `plt` or `rtd`, or null when the extension is not one the programs read. */
export function fileSlot(name: string): "ncd" | "dtd" | "plt" | "rtd" | null {
  const m = /\.([A-Za-z0-9]+)$/.exec(name.trim());
  const ext = m ? m[1].toLowerCase() : "";
  return ext === "ncd" || ext === "dtd" || ext === "plt" || ext === "rtd" ? ext : null;
}

/** The kind of job the files make: a drilling file means drilling, an HP-GL file routing; null when there are none of them. */
export function kindOfFiles(files: SourceFiles): "drill" | "route" | null {
  if ("ncd" in files) return "drill";
  if ("plt" in files) return "route";
  return null;
}

/** A name for the job from the name of its first file, without the extension. */
export function nameFromFile(name: string): string {
  return name.replace(/^.*[\\/]/, "").replace(/\.[^.]*$/, "").slice(0, 60);
}

// ---- the plan: where each hole and each path is on the drawing

export interface PlanBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The box of the drawing in millimetres, with a margin; a plan with nothing on it still has a box. */
export function planBox(view: Pick<JobView, "bounds_mm">, marginMm = 2): PlanBox {
  const b = view.bounds_mm;
  if (!b || b.length !== 4) return { x: 0, y: 0, w: 100, h: 80 };
  const [x0, y0, x1, y1] = b;
  const w = Math.max(x1 - x0, 1) + 2 * marginMm;
  const h = Math.max(y1 - y0, 1) + 2 * marginMm;
  return { x: x0 - marginMm, y: y0 - marginMm, w, h };
}

/** How many holes are finished when the job has reached `itemsDone`: `hole_ends[i]` is the item at which the hole `i` is finished. */
export function holesDone(view: Pick<JobView, "hole_ends">, itemsDone: number): number {
  const ends = view.hole_ends ?? [];
  let n = 0;
  while (n < ends.length && ends[n] <= itemsDone) n += 1;
  return n;
}

/** Ten colours for the tools of a plan, taken in turn. */
export const TOOL_COLOURS = ["#4cc9f0", "#f72585", "#b5e048", "#ffb703", "#9d4edd", "#2ec4b6", "#ff6b35", "#8ecae6", "#e5989b", "#cdb4db"];

export function toolColour(tool: number): string {
  return TOOL_COLOURS[(Math.max(tool, 1) - 1) % TOOL_COLOURS.length];
}

/** The size a hole is drawn at: a fifth of a millimetre at least would vanish on a big board, so it follows the box. */
export function holeRadius(box: PlanBox): number {
  return Math.max(Math.max(box.w, box.h) / 150, 0.35);
}

// ---- the list of jobs

/** Does a job match what the person typed (name, machine, person or state, any part, ignoring case)? */
export function matchesQuery(j: Pick<JobSummary, "name" | "machine" | "by" | "state">, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q === "") return true;
  return q.split(/\s+/).every((word) => [j.name, j.machine, j.by, j.state].some((v) => v.toLowerCase().includes(word)));
}

export type JobOrder = "newest" | "oldest" | "name" | "machine" | "progress";
export const JOB_ORDERS: JobOrder[] = ["newest", "oldest", "name", "machine", "progress"];

export function sortJobs(jobs: JobSummary[], order: JobOrder): JobSummary[] {
  const by: Record<JobOrder, (a: JobSummary, b: JobSummary) => number> = {
    newest: (a, b) => b.created - a.created,
    oldest: (a, b) => a.created - b.created,
    name: (a, b) => a.name.localeCompare(b.name),
    machine: (a, b) => a.machine.localeCompare(b.machine) || b.created - a.created,
    progress: (a, b) => b.items_done / Math.max(b.items_total, 1) - a.items_done / Math.max(a.items_total, 1),
  };
  return [...jobs].sort(by[order]);
}

/** The jobs that wait for the operator, the oldest first (the one that has waited longest is the one to answer first). */
export function waitingJobs(jobs: JobSummary[]): JobSummary[] {
  return jobs.filter((j) => j.state === "waiting_operator").sort((a, b) => (a.started ?? a.created) - (b.started ?? b.created));
}

/** The ids of the jobs that are over (done, cancelled or failed), to clear them. */
export function finishedIds(jobs: JobSummary[]): string[] {
  const over: JobState[] = ["done", "cancelled", "failed"];
  return jobs.filter((j) => over.includes(j.state)).map((j) => j.id);
}

function csvCell(v: string | number | null): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The jobs as CSV (comma separated, with a header line); the times are seconds since 1970 as the server keeps them. */
export function jobsCsv(jobs: JobSummary[]): string {
  const head = ["id", "name", "machine", "kind", "state", "by", "created", "started", "finished", "items_done", "items_total", "holes_done", "holes_total", "line", "estimate_s", "message"];
  const rows = jobs.map((j) => [j.id, j.name, j.machine, j.kind, j.state, j.by, j.created, j.started, j.finished, j.items_done, j.items_total, j.holes_done, j.holes_total, j.line ?? 0, j.estimate_s, j.message].map(csvCell).join(","));
  return [head.join(","), ...rows].join("\r\n") + "\r\n";
}

/** The time a finished job took, in seconds, or null when it did not both start and finish. */
export function took(j: Pick<JobSummary, "started" | "finished">): number | null {
  return j.started != null && j.finished != null && j.finished >= j.started ? j.finished - j.started : null;
}

/** The totals of the finished jobs of a list: how many are done, how many holes they drilled and how long they took. */
export function totals(jobs: JobSummary[]): { done: number; failed: number; holes: number; seconds: number } {
  let done = 0;
  let failed = 0;
  let holes = 0;
  let seconds = 0;
  for (const j of jobs) {
    if (j.state === "done") {
      done += 1;
      holes += j.holes_done;
      seconds += took(j) ?? 0;
    } else if (j.state === "failed") {
      failed += 1;
    }
  }
  return { done, failed, holes, seconds };
}

// ---- machines moved between servers

/** A machine as a file to keep: the node's token is never in it (the server does not give it away). */
export function machineExport(machines: { id: string; name: string; model: string; station: string; connection: { kind: string; address: string; port?: string; baud?: number }; dcf: string; rcf: string; cfg: string }[]): string {
  const clean = machines.map((m) => ({
    id: m.id,
    name: m.name,
    model: m.model,
    station: m.station,
    connection: m.connection.kind === "grbl" ? { kind: "grbl", port: m.connection.port ?? m.connection.address, baud: m.connection.baud ?? 115200 } : { kind: m.connection.kind, address: m.connection.address },
    dcf: m.dcf,
    rcf: m.rcf,
    cfg: m.cfg,
  }));
  return JSON.stringify({ eh3d_machines: 1, machines: clean }, null, 2) + "\n";
}

/** The machines of a file made by machineExport, or null when it is not one. */
export function machineImport(text: string): { id: string; name: string; model: string; station: string; connection: { kind: "node" | "demo" | "grbl"; address?: string; port?: string; baud?: number }; dcf: string; rcf: string; cfg: string }[] | null {
  try {
    const v = JSON.parse(text) as { eh3d_machines?: number; machines?: unknown };
    if (v.eh3d_machines !== 1 || !Array.isArray(v.machines)) return null;
    const out = [];
    for (const raw of v.machines as Record<string, unknown>[]) {
      const c = (raw.connection ?? {}) as { kind?: string; address?: string; port?: string; baud?: number };
      if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
      out.push({
        id: raw.id,
        name: raw.name,
        model: typeof raw.model === "string" ? raw.model : "ccd-mtc",
        station: typeof raw.station === "string" ? raw.station : "",
        connection:
          c.kind === "node"
            ? { kind: "node" as const, address: c.address ?? "" }
            : c.kind === "grbl"
              ? { kind: "grbl" as const, port: typeof c.port === "string" ? c.port : "", baud: typeof c.baud === "number" ? c.baud : 115200 }
              : { kind: "demo" as const },
        dcf: typeof raw.dcf === "string" ? raw.dcf : "",
        rcf: typeof raw.rcf === "string" ? raw.rcf : "",
        cfg: typeof raw.cfg === "string" ? raw.cfg : "",
      });
    }
    return out;
  } catch {
    return null;
  }
}

/** An id for the copy of a machine that is not taken: `bungard` becomes `bungard-2`, `bungard-3` ... (32 characters at most). */
export function copyId(id: string, taken: string[]): string {
  const base = id.replace(/-\d+$/, "");
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base.slice(0, 32 - String(n).length - 1)}-${n}`;
    if (!taken.includes(candidate)) return candidate;
  }
  return `${base.slice(0, 26)}-copy`;
}

// ---- one machine and its queue

/** The jobs of one machine split as the page shows them: the one that is active, the ones that are ready (oldest first, the order they were made) and the last finished. */
export function machineQueue(jobs: JobSummary[], machine: string, lastN = 8): { active: JobSummary | null; ready: JobSummary[]; recent: JobSummary[]; readySeconds: number } {
  const mine = jobs.filter((j) => j.machine === machine);
  const active = mine.find((j) => j.state === "connecting" || j.state === "running" || j.state === "waiting_operator") ?? null;
  const ready = mine.filter((j) => j.state === "ready").sort((a, b) => a.created - b.created);
  const over: JobState[] = ["done", "cancelled", "failed"];
  const recent = mine
    .filter((j) => over.includes(j.state))
    .sort((a, b) => (b.finished ?? b.created) - (a.finished ?? a.created))
    .slice(0, lastN);
  const readySeconds = ready.reduce((n, j) => n + (j.estimate_s ?? 0), 0);
  return { active, ready, recent, readySeconds };
}

/** The names of `copies` copies of a job: `board`, `board #2`, `board #3` ... (60 characters at most). */
export function copyNames(name: string, copies: number): string[] {
  const n = Math.max(1, Math.min(Math.floor(copies) || 1, 50));
  return Array.from({ length: n }, (_, i) => (i === 0 ? name : `${name.slice(0, 54)} #${i + 1}`));
}

/** The drawing as a file to keep: the SVG of the page with its own size and a white margin-less background. */
export function svgFile(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("class");
  clone.setAttribute("width", "800");
  const vb = (clone.getAttribute("viewBox") ?? "0 0 100 80").split(/\s+/).map(Number);
  clone.setAttribute("height", String(Math.round((800 * vb[3]) / Math.max(vb[2], 1))));
  const bg = clone.querySelector(".plan-bg");
  bg?.setAttribute("fill", "#ffffff");
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone) + "\n";
}

/** A button that needs a second touch: the first one arms it (and the button asks), the second one fires. Leaving the button disarms it. */
export function twoSteps(armed: boolean): { armed: boolean; fire: boolean } {
  return armed ? { armed: false, fire: true } : { armed: true, fire: false };
}
