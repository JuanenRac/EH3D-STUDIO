/* The shapes the server answers with (docs/API.md of EH3D-SERVER). Fields the pages do not read are not listed. GPL-3.0-or-later. */

export type Role = "viewer" | "operator" | "admin";
export const ROLES: Role[] = ["viewer", "operator", "admin"];

export interface Health {
  name: string;
  version: string;
}

export interface Session {
  name: string;
  role: Role;
  is_token: boolean;
}

export interface UserInfo {
  name: string;
  role: Role;
  disabled: boolean;
}

export interface TokenInfo {
  id: string;
  name: string;
  role: Role;
  created: number;
}

export interface NewToken {
  id: string;
  /** Shown once: the server keeps only its hash. */
  token: string;
}

export type ConnectionKind = "node" | "demo" | "grbl";
export const CONNECTION_KINDS: ConnectionKind[] = ["demo", "node", "grbl"];

export interface Machine {
  id: string;
  name: string;
  model: string;
  station: string;
  connection: { kind: ConnectionKind; address: string; token_set: boolean; port?: string; baud?: number };
  dcf: string;
  rcf: string;
  cfg: string;
  spindle?: SpindleId | "";
  spindle_guard?: string;
  /** Whether the G-code jobs of this machine may carry the `$` lines of GRBL (off unless an administrator turned it on). */
  allow_dollar?: boolean;
}

/** What is sent to create or change a machine; an empty node token keeps the stored one. */
/** The limits of one spindle (`docs/API.md` of EH3D-SERVER, "the spindle of the machine"). */
export interface SpindleLimits {
  min_rpm: number;
  max_rpm: number;
  power_w: number;
  max_xy_mm_min: number;
  max_z_mm_min: number;
  max_bit_mm: number;
}

export type SpindleId = "original" | "vfd";
export type SpindleGuard = "reject" | "warn";
export const SPINDLE_IDS: SpindleId[] = ["original", "vfd"];

/** The spindle a machine carries, what happens to a job beyond it, and the top speed its node should be set to. */
export interface SpindleView {
  spindle: SpindleId | "";
  guard: SpindleGuard;
  limits: Record<SpindleId, SpindleLimits>;
  active: SpindleLimits | null;
  node_max_rpm: number | null;
}

/** One thing a job asks for beyond the spindle (`spindle_warnings` of the view, when the machine's switch is on `warn`). */
export interface SpindleFinding {
  code: "rpm_above_max" | "rpm_below_min" | "feed_xy_above_max" | "feed_z_above_max";
  tool: number;
  value: number;
  limit: number;
}

export interface MachineInput {
  id: string;
  name: string;
  model: string;
  station: string;
  connection: { kind: ConnectionKind; address?: string; token?: string; port?: string; baud?: number };
  dcf: string;
  rcf: string;
  cfg: string;
  /** The safety switch of the `$` lines of GRBL; only an administrator may send it, and an update that leaves it out keeps it. */
  allow_dollar?: boolean;
}

/** What a job is: a drilling job, a routing job, or the free G-code program of a GRBL machine or of the simulator. */
export type JobKind = "drill" | "route" | "gcode";
export const JOB_KINDS: JobKind[] = ["drill", "route", "gcode"];

/** What a job waits for: a tool change or the spindle start (drilling and routing), a hold of the operator or the wait before the first move of a job that goes on (G-code). */
export interface JobPause {
  kind: "tool_change" | "spindle_start" | "hold" | "resume" | string;
  tool?: number;
}

/** What `GET /jobs/:id/request` answers: the request of the job as it came, and where a stopped job goes on from (`null` for a job that did not stop). */
export interface SavedRequest {
  id: string;
  machine: string;
  kind: JobKind;
  name: string;
  state: JobState;
  resumed_from: string;
  next_skip: number | null;
  request: Record<string, unknown>;
}

export type JobState = "ready" | "connecting" | "running" | "waiting_operator" | "done" | "cancelled" | "failed";
export const JOB_STATES: JobState[] = ["ready", "connecting", "running", "waiting_operator", "done", "cancelled", "failed"];

export interface JobSummary {
  id: string;
  machine: string;
  name: string;
  kind: JobKind;
  state: JobState;
  created: number;
  started: number | null;
  finished: number | null;
  by: string;
  items_total: number;
  items_done: number;
  holes_total: number;
  holes_done: number;
  /** A G-code job: the line of the program text it has got to, which is where a job that goes on starts from; 0 for the others. */
  line?: number;
  /** The job this one goes on from (made by `resume-from`); empty for the others. */
  resumed_from?: string;
  message: string | null;
  pause: JobPause | null;
  estimate_s: number | null;
}

/** What a client draws and follows (docs/API.md of EH3D-SERVER, "the view"). */
export interface JobView {
  kind: JobKind;
  name: string;
  tools: { number: number; spindle_rpm: number | null; count: number; feed_mm_min: number | null; depth_mm: number | null; iterations: number | null }[];
  holes: { tool: number; x_mm: number; y_mm: number }[];
  paths: { pen?: number; tool?: number; points_mm: [number, number][] }[];
  bounds_mm: [number, number, number, number] | null;
  items: number;
  hole_ends: number[];
  estimate_s: number | null;
  travel_mm: number | null;
  spindle_warnings?: SpindleFinding[];
  /** The tools (or pens) that were switched off and how many holes or paths were already done, as the server left them out. */
  skipped_tools?: number[];
  skipped?: number;
}

export interface Job extends JobSummary {
  view: JobView | null;
}

export type MachineState = "idle" | "busy" | "waiting";

export interface FleetJob {
  id: string;
  name: string;
  kind: string;
  state: string;
  percent: number;
  items_done: number;
  items_total: number;
  pause: JobPause | null;
}

export interface FleetMachine {
  id: string;
  name: string;
  model: string;
  station: string;
  connection: string;
  state: MachineState;
  job: FleetJob | null;
  ready: number;
}

/** What the server says about the updates of the installed services (see docs/API.md of EH3D-SERVER). */
export interface UpdateComponent {
  id: string;
  name: string;
  installed: string | null;
  latest: string | null;
  newer: boolean;
  url: string | null;
  published: string | null;
}

export type UpdateState = "idle" | "checking" | "updating" | "done" | "error";

export interface UpdatesView {
  enabled: boolean;
  pending: boolean;
  state: UpdateState;
  message: string;
  log: string[];
  components: UpdateComponent[];
}

export interface Fleet {
  stations: { id: string; machines: string[] }[];
  machines: FleetMachine[];
  summary: { machines: number; idle: number; busy: number; waiting: number; stations: number };
}

/** What the node of the drill head says about itself (`GET /api/v1/machines/:id/head/status`, the answer of EH3D-NODE-BUNGARD-AUX). */
export interface HeadStatus {
  node: string;
  version: string;
  camera: boolean;
  camera_model?: string;
  laser: boolean;
  rpm_sensor: boolean;
  rpm: number;
  temp_c: number | null;
  heat: "ok" | "warm" | "hot" | "unknown";
  protect_open: boolean;
  uptime_s: number;
}

/** One measure of the table under the head. */
export interface HeadMeasure {
  ok: boolean;
  why?: string;
  distance_mm: number;
  sigma_mm: number;
  asked: number;
  used: number;
  rejected: number;
}

/** The ring of LEDs around the camera of the drill head, as the node says it (`GET .../head/light`). */
export interface HeadLight {
  on: boolean;
  level: number;
  max_level?: number;
  tone?: string;
  sectors?: string;
  leds?: number;
  auto_off_s?: number;
  color?: string;
  cue?: string;
}

export const LIGHT_TONES = ["white", "cool", "warm", "red", "green", "blue"] as const;

/** The last quality check of the work through the camera of the head (`GET .../head/inspect`): only what the page shows is listed. */
export interface HeadInspection {
  verdict: "ok" | "not_ok" | "unknown";
  quality?: Record<string, number> | null;
  findings?: { code: string; hole?: number; fails?: boolean }[];
}
