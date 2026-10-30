/* What the pages decide with: the navigation and who may see what, the rules a name or a password must follow before it is sent, how the fleet is grouped, and
 * how a job is counted. Pure functions, tested on their own. GPL-3.0-or-later. */
import type { Fleet, FleetMachine, JobState, JobSummary, Machine, MachineInput, Role } from "./types";

// ---- the navigation: every page belongs to a group and needs a role

export type PageId = "overview" | "fleet" | "prepare" | "jobs" | "job" | "live" | "machines" | "access" | "server" | "updates" | "account" | "preferences" | "about";

export interface PageDef {
  id: PageId;
  group: "monitor" | "configure" | "account";
  needs: Role;
  /** Reached from a link, not from the menu. */
  hidden?: boolean;
}

export const PAGES: PageDef[] = [
  { id: "overview", group: "monitor", needs: "viewer" },
  { id: "fleet", group: "monitor", needs: "viewer" },
  { id: "prepare", group: "monitor", needs: "operator" },
  { id: "jobs", group: "monitor", needs: "viewer" },
  { id: "job", group: "monitor", needs: "viewer", hidden: true },
  { id: "live", group: "monitor", needs: "viewer" },
  { id: "machines", group: "configure", needs: "admin" },
  { id: "access", group: "configure", needs: "admin" },
  { id: "server", group: "configure", needs: "viewer" },
  { id: "updates", group: "configure", needs: "admin" },
  { id: "account", group: "account", needs: "viewer" },
  { id: "preferences", group: "account", needs: "viewer" },
  { id: "about", group: "account", needs: "viewer" },
];

const RANK: Record<Role, number> = { viewer: 0, operator: 1, admin: 2 };

export function atLeast(have: Role, need: Role): boolean {
  return RANK[have] >= RANK[need];
}

/** The pages a role may open, in the order of the menu. */
export function pagesFor(role: Role): PageDef[] {
  return PAGES.filter((p) => atLeast(role, p.needs));
}

export function isPageId(s: string): s is PageId {
  return PAGES.some((p) => p.id === s);
}

/** The page and the thing it shows from the address after the `#`: `/jobs`, `/job/ab12`. */
export function parseRoute(hash: string): { page: PageId; param: string } {
  const [id, ...rest] = hash.replace(/^#\/?/, "").split("/");
  return { page: isPageId(id) ? id : "overview", param: decodeURIComponent(rest.join("/")) };
}

// ---- the rules of the server, checked before a request goes out

const NAME = /^[A-Za-z0-9._-]{1,32}$/;

/** A user name, a machine id or a station: letters, digits, `.`, `_` and `-` up to 32. */
export function validName(s: string): boolean {
  return NAME.test(s);
}

/** Passwords are 8 to 128 characters. */
export function validPassword(s: string): boolean {
  const n = [...s].length;
  return n >= 8 && n <= 128;
}

/** `host:port` of a node, with the port from 1 to 65535. */
export function validAddress(s: string): boolean {
  const m = /^([A-Za-z0-9._-]+|\[[0-9A-Fa-f:]+\]):(\d{1,5})$/.exec(s.trim());
  if (!m) return false;
  const port = Number(m[2]);
  return port >= 1 && port <= 65535;
}

export type MachineProblem = "id" | "name" | "station" | "address";

/** What is wrong with a machine before it is sent (the server checks again, and says more: unknown keys of the configuration, for one). */
export function machineProblems(m: MachineInput): MachineProblem[] {
  const out: MachineProblem[] = [];
  if (!validName(m.id)) out.push("id");
  if (m.name.trim() === "" || m.name.length > 64) out.push("name");
  if (m.station !== "" && !validName(m.station)) out.push("station");
  if (m.connection.kind === "node" && !validAddress(m.connection.address ?? "")) out.push("address");
  return out;
}

export function emptyMachine(): MachineInput {
  return { id: "", name: "", model: "ccd-mtc", station: "", connection: { kind: "demo" }, dcf: "", rcf: "", cfg: "" };
}

/** A machine as the server shows it, as the form edits it (the token of the node is never shown, so the field starts empty). */
export function toInput(m: Machine): MachineInput {
  return { id: m.id, name: m.name, model: m.model, station: m.station, connection: { kind: m.connection.kind, address: m.connection.address, token: "" }, dcf: m.dcf, rcf: m.rcf, cfg: m.cfg };
}

// ---- the updates of the installed services

/** The components that have a newer release than the one installed. */
export function updatable(view: { components: { id: string; newer: boolean }[] }): string[] {
  return view.components.filter((c) => c.newer).map((c) => c.id);
}

/** The helper is checking or updating, or a request waits for it: the page asks again soon and offers no new request. */
export function updatesBusy(view: { pending: boolean; state: string }): boolean {
  return view.pending || view.state === "checking" || view.state === "updating";
}

// ---- the fleet and the jobs

export interface StationGroup {
  station: string;
  machines: FleetMachine[];
}

/** The machines under their stations, the stations in the order of the server and the machines without one last. */
export function groupFleet(f: Fleet): StationGroup[] {
  const byId = new Map(f.machines.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const out: StationGroup[] = [];
  for (const st of f.stations) {
    const machines = st.machines.map((id) => byId.get(id)).filter((m): m is FleetMachine => !!m);
    machines.forEach((m) => seen.add(m.id));
    if (machines.length) out.push({ station: st.id, machines });
  }
  const rest = f.machines.filter((m) => !seen.has(m.id));
  if (rest.length) {
    // the server lists the machines that have no station under the station "": the ones it did not list join them
    const loose = out.find((g) => g.station === "");
    if (loose) loose.machines.push(...rest);
    else out.push({ station: "", machines: rest });
  }
  return out.sort((a, b) => (a.station === "" ? 1 : 0) - (b.station === "" ? 1 : 0));
}

export const ACTIVE_STATES: JobState[] = ["connecting", "running", "waiting_operator"];

export function isActive(j: { state: JobState }): boolean {
  return ACTIVE_STATES.includes(j.state);
}

export function isFinished(j: { state: JobState }): boolean {
  return j.state === "done" || j.state === "cancelled" || j.state === "failed";
}

export function countJobs(jobs: JobSummary[]): Record<JobState, number> {
  const out: Record<JobState, number> = { ready: 0, connecting: 0, running: 0, waiting_operator: 0, done: 0, cancelled: 0, failed: 0 };
  for (const j of jobs) out[j.state] += 1;
  return out;
}

/** Progress of a job from 0 to 100. */
export function jobPercent(j: Pick<JobSummary, "items_total" | "items_done" | "state">): number {
  if (j.state === "done") return 100;
  if (j.items_total <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((100 * j.items_done) / j.items_total)));
}

/** What the person may do with a job in this state. */
export function jobActions(j: { state: JobState }, role: Role): { start: boolean; confirm: boolean; cancel: boolean; remove: boolean } {
  const operator = atLeast(role, "operator");
  return {
    start: operator && j.state === "ready",
    confirm: operator && j.state === "waiting_operator",
    cancel: operator && (j.state === "ready" || isActive(j)),
    remove: operator && (j.state === "ready" || isFinished(j)),
  };
}

/** `1 h 05 min`, `3 min 20 s`, `45 s`. */
export function duration(seconds: number | null | undefined): string {
  if (seconds == null || !isFinite(seconds) || seconds < 0) return "-";
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h} h ${String(m).padStart(2, "0")} min`;
  if (m > 0) return `${m} min ${String(r).padStart(2, "0")} s`;
  return `${r} s`;
}

/** The text of a configuration of a machine as lines, to count what is set. */
export function cfgKeys(cfg: string): string[] {
  return cfg
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#") && !l.startsWith(";") && l.includes("="))
    .map((l) => l.slice(0, l.indexOf("=")).trim());
}
