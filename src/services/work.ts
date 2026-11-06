/*
 * The machine plugins, the generic queue of jobs and the notifications of the server (`/api/v1/plugins`, `/work/...`, `/notifications`; docs/MACHINE_PLUGINS.md of EH3D-SERVER):
 * the client, and the rules the panel decides with — which buttons a job has in its state, the filters and the order of the queue, and the request typed by hand.
 * GPL-3.0-or-later.
 */
import type { ServiceHttp } from "./http";
import { can } from "./permissions";
import type { Who } from "./permissions";
import type { NewWorkJob, NewWorkMachine, PluginInfo, WorkJob, WorkJobPage, WorkJobSummary, WorkMachineInfo, WorkNotification, WorkState } from "./types";

export class WorkClient {
  constructor(private http: ServiceHttp) {}

  plugins = async (): Promise<PluginInfo[]> => (await this.http.json<{ plugins: PluginInfo[] }>("GET", "/plugins")).plugins;
  machines = async (): Promise<WorkMachineInfo[]> => (await this.http.json<{ machines: WorkMachineInfo[] }>("GET", "/work/machines")).machines;
  addMachine = (m: NewWorkMachine) => this.http.json<unknown>("POST", "/work/machines", { json: m });
  deleteMachine = (id: string) => this.http.json<unknown>("DELETE", `/work/machines/${encodeURIComponent(id)}`);

  jobs = (f: { machine?: string; state?: string; app?: string; mine?: boolean; limit?: number; offset?: number } = {}) =>
    this.http.json<WorkJobPage>("GET", "/work/jobs", { query: { machine: f.machine, state: f.state, app: f.app, mine: f.mine ? "true" : undefined, limit: f.limit ?? 100, offset: f.offset } });
  job = (id: string) => this.http.json<WorkJob>("GET", `/work/jobs/${encodeURIComponent(id)}`);
  create = (job: NewWorkJob) => this.http.json<WorkJob>("POST", "/work/jobs", { json: job, transfer: true });
  start = (id: string) => this.http.json<WorkJob>("POST", `/work/jobs/${encodeURIComponent(id)}/start`, { json: {}, transfer: true });
  pause = (id: string) => this.http.json<WorkJob>("POST", `/work/jobs/${encodeURIComponent(id)}/pause`, { json: {} });
  resume = (id: string) => this.http.json<WorkJob>("POST", `/work/jobs/${encodeURIComponent(id)}/resume`, { json: {} });
  cancel = (id: string) => this.http.json<WorkJob>("POST", `/work/jobs/${encodeURIComponent(id)}/cancel`, { json: {} });
  remove = (id: string) => this.http.json<unknown>("DELETE", `/work/jobs/${encodeURIComponent(id)}`);

  notifications = async (unread = false): Promise<WorkNotification[]> =>
    (await this.http.json<{ notifications: WorkNotification[] }>("GET", "/notifications", { query: { unread: unread ? "true" : undefined, limit: 100 } })).notifications;
  markRead = (req: { ids?: number[]; all?: boolean }) => this.http.json<{ marked: number }>("POST", "/notifications/read", { json: req });
}

// ---- the state of a job

export const ACTIVE_STATES: readonly WorkState[] = ["queued", "running", "paused"];
export const FINISHED_STATES: readonly WorkState[] = ["done", "failed", "cancelled"];

export function isFinished(s: WorkState): boolean {
  return FINISHED_STATES.includes(s);
}

export const WORK_TONE: Record<WorkState, "ok" | "run" | "wait" | "bad" | "dim"> = {
  queued: "dim",
  running: "run",
  paused: "wait",
  done: "ok",
  failed: "bad",
  cancelled: "dim",
};

export type JobAction = "start" | "pause" | "resume" | "cancel" | "remove";

/** Whether the machine of the job can be held: the capability `pause` of the plugin is `all`, `gcode` (only a free G-code job; the server refuses the rest) or none. A plugin that does not say is asked. */
export function canHold(caps: Record<string, unknown> | undefined): boolean {
  if (!caps) return true;
  const v = caps.pause;
  if (v === undefined) return true;
  return !(v === false || v === "none" || v === "");
}

/** The kinds of request the plugin of a machine takes (its capability `requests`). */
export function requestKinds(caps: Record<string, unknown> | undefined): string[] {
  const r = caps?.requests;
  return Array.isArray(r) ? r.filter((x): x is string => typeof x === "string") : [];
}

/** The buttons a job has in its state for this person: what the role allows and what the state makes possible. The server decides in the end. */
export function jobActions(job: Pick<WorkJobSummary, "state">, who: Who | null | undefined, caps?: Record<string, unknown>): JobAction[] {
  const out: JobAction[] = [];
  const start = can(who, "jobs.start");
  const cancel = can(who, "jobs.cancel");
  if (job.state === "queued") {
    if (start) out.push("start");
    if (cancel) out.push("cancel");
  } else if (job.state === "running") {
    if (start && canHold(caps)) out.push("pause");
    if (cancel) out.push("cancel");
  } else if (job.state === "paused") {
    if (start) out.push("resume");
    if (cancel) out.push("cancel");
  } else if (cancel) {
    out.push("remove");
  }
  return out;
}

/** The actions that stop or remove work are asked twice; starting asks once too (the first touch asks, the second one does it). */
export const NEEDS_CONFIRMATION: readonly JobAction[] = ["start", "cancel", "remove"];

// ---- the queue

export interface QueueFilter {
  machine: string;
  state: string;
  query: string;
  mine: boolean;
  me: string;
}

export function filterQueue(jobs: readonly WorkJobSummary[], f: QueueFilter): WorkJobSummary[] {
  const q = f.query.trim().toLowerCase();
  return jobs.filter((j) => {
    if (f.machine && j.machine !== f.machine) return false;
    if (f.state === "active" ? !ACTIVE_STATES.includes(j.state) : f.state && j.state !== f.state) return false;
    if (f.mine && j.owner !== f.me) return false;
    if (q && !`${j.name ?? ""} ${j.id} ${j.machine} ${j.owner ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

/** The queue as the panel lists it: what is running first, then what waits (in its place), then the finished, the newest first. */
export function orderQueue(jobs: readonly WorkJobSummary[]): WorkJobSummary[] {
  const rank = (s: WorkState) => (s === "running" ? 0 : s === "paused" ? 1 : s === "queued" ? 2 : 3);
  return [...jobs].sort((a, b) => {
    if (rank(a.state) !== rank(b.state)) return rank(a.state) - rank(b.state);
    if (a.state === "queued" && b.state === "queued") return (a.position ?? 0) - (b.position ?? 0);
    return (b.created ?? 0) - (a.created ?? 0);
  });
}

export function percentOf(j: Pick<WorkJobSummary, "percent" | "done" | "total" | "state">): number {
  if (j.state === "done") return 100;
  if (typeof j.percent === "number") return Math.max(0, Math.min(100, j.percent));
  if (j.total && j.total > 0 && j.done !== undefined) return Math.max(0, Math.min(100, Math.round((j.done / j.total) * 100)));
  return 0;
}

export function countByState(jobs: readonly WorkJobSummary[]): Record<WorkState, number> {
  const out: Record<WorkState, number> = { queued: 0, running: 0, paused: 0, done: 0, failed: 0, cancelled: 0 };
  for (const j of jobs) out[j.state] += 1;
  return out;
}

/** A job asked for by a person is applied to the list at once from the answer of the server (the list is asked for again after). */
export function applyJob(list: readonly WorkJobSummary[], job: WorkJobSummary): WorkJobSummary[] {
  const at = list.findIndex((j) => j.id === job.id);
  if (at < 0) return [job, ...list];
  const copy = [...list];
  copy[at] = { ...copy[at], ...job };
  return copy;
}

// ---- the request typed by hand

export type RequestParse = { ok: true; value: Record<string, unknown> } | { ok: false; reason: "empty" | "syntax" | "not_object" };

/** The request of a job as the person typed it: it has to be a JSON object. The plugin judges its content. */
export function parseRequest(text: string): RequestParse {
  if (text.trim() === "") return { ok: false, reason: "empty" };
  try {
    const v: unknown = JSON.parse(text);
    if (typeof v !== "object" || v === null || Array.isArray(v)) return { ok: false, reason: "not_object" };
    return { ok: true, value: v as Record<string, unknown> };
  } catch {
    return { ok: false, reason: "syntax" };
  }
}

/** A request to start from, for the kinds a plugin takes: the demo machine takes a number of steps, a G-code job takes its text. */
export function requestTemplate(kinds: readonly string[]): string {
  if (kinds.includes("demo")) return JSON.stringify({ kind: "demo", steps: 10 }, null, 2);
  if (kinds.includes("gcode")) return JSON.stringify({ kind: "gcode", gcode: "G21\nG90\n" }, null, 2);
  if (kinds.length > 0) return JSON.stringify({ kind: kinds[0] }, null, 2);
  return "{}";
}

/** The settings of a new machine of a plugin that keeps its machines here, typed by hand: a JSON object or nothing. */
export function parseSettings(text: string): Record<string, unknown> | null {
  if (text.trim() === "") return {};
  const p = parseRequest(text);
  return p.ok ? p.value : null;
}

/** Whether a machine id is one the server takes: lower case letters, digits and hyphens up to 32. */
export function validMachineId(s: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,31}$/.test(s);
}

// ---- the notifications

export function unreadCount(list: readonly WorkNotification[]): number {
  return list.filter((n) => !n.read).length;
}

/** The notifications after some were read here (the server is told in the same moment). */
export function markedRead(list: readonly WorkNotification[], ids: readonly number[] | "all"): WorkNotification[] {
  return list.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n));
}

/** Adds the notification that came on the stream to the list, once. */
export function withNotification(list: readonly WorkNotification[], n: WorkNotification): WorkNotification[] {
  if (list.some((x) => x.id === n.id)) return [...list];
  return [n, ...list].slice(0, 100);
}

/** Reads the notification out of the data of a `notification` event. */
export function notificationFromEvent(data: unknown): WorkNotification | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;
  if (typeof d.id !== "number" || typeof d.kind !== "string") return null;
  return { id: d.id, kind: d.kind, title: typeof d.title === "string" ? d.title : d.kind, at: typeof d.at === "number" ? d.at : undefined, data: (d.data as Record<string, unknown>) ?? undefined, read: false };
}
