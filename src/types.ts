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

export type ConnectionKind = "node" | "demo";

export interface Machine {
  id: string;
  name: string;
  model: string;
  station: string;
  connection: { kind: ConnectionKind; address: string; token_set: boolean };
  dcf: string;
  rcf: string;
  cfg: string;
}

/** What is sent to create or change a machine; an empty node token keeps the stored one. */
export interface MachineInput {
  id: string;
  name: string;
  model: string;
  station: string;
  connection: { kind: ConnectionKind; address?: string; token?: string };
  dcf: string;
  rcf: string;
  cfg: string;
}

export type JobState = "ready" | "connecting" | "running" | "waiting_operator" | "done" | "cancelled" | "failed";
export const JOB_STATES: JobState[] = ["ready", "connecting", "running", "waiting_operator", "done", "cancelled", "failed"];

export interface JobSummary {
  id: string;
  machine: string;
  name: string;
  kind: "drill" | "route";
  state: JobState;
  created: number;
  started: number | null;
  finished: number | null;
  by: string;
  items_total: number;
  items_done: number;
  holes_total: number;
  holes_done: number;
  message: string | null;
  pause: { kind: string; tool?: number } | null;
  estimate_s: number | null;
}

export interface Job extends JobSummary {
  view: unknown;
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
  pause: { kind: string; tool?: number } | null;
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
