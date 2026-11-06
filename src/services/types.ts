/* The shapes of the four common services of EH3D-SERVER (docs/openapi.yaml of that repository: the tags `store`, `catalogs`, `work` and `auth`), with the names of
 * its schemas. Fields the pages do not read are not listed. GPL-3.0-or-later. */
import type { Role } from "../types";

// ---- the project store

export interface StoreLock {
  holder: string;
  since?: number;
  /** Seconds since 1970 at which the lock ends by itself. */
  expires: number;
}

export interface StoreFile {
  name: string;
  version: number;
  /** The SHA-256 of the current version: also its tag (`ETag`). */
  sha256: string;
  size: number;
  at?: number;
  by?: string;
}

export interface StoreVersion {
  version: number;
  sha256: string;
  size: number;
  at?: number;
  by?: string;
  comment?: string;
}

export interface StoreProjectSummary {
  id: string;
  app: string;
  name: string;
  owner: string;
  created?: number;
  updated?: number;
  etag: string;
  deleted?: boolean;
  files?: number;
  locked?: boolean;
}

export interface StoreProjectPage {
  total: number;
  offset: number;
  limit: number;
  items: StoreProjectSummary[];
}

export interface StoreProject {
  id: string;
  app: string;
  name: string;
  owner: string;
  created?: number;
  updated?: number;
  etag: string;
  deleted?: boolean;
  bytes?: number;
  lock?: StoreLock | null;
  files: StoreFile[];
}

export interface StoreVersionList {
  name: string;
  versions: StoreVersion[];
}

export interface StoreLockState {
  lock: StoreLock | null;
}

/** The version written; `unchanged` is true when the bytes were those of the current version and no version was made. */
export type StoreWriteResult = StoreVersion & { name: string; unchanged: boolean };

export interface StoreImportResult {
  imported: number;
  unchanged: number;
  files: { name: string; version: number; unchanged: boolean }[];
}

// ---- machine plugins, the queue of jobs and the notifications

export interface PluginInfo {
  kind: string;
  title: string;
  capabilities: Record<string, unknown>;
  manages_machines: boolean;
}

export interface WorkMachineInfo {
  id: string;
  name: string;
  plugin: string;
  state: "idle" | "busy";
  job?: string | null;
  capabilities?: Record<string, unknown>;
}

export interface NewWorkMachine {
  id: string;
  name: string;
  plugin: string;
  settings?: Record<string, unknown>;
}

export type WorkState = "queued" | "running" | "paused" | "done" | "failed" | "cancelled";
export const WORK_STATES: WorkState[] = ["queued", "running", "paused", "done", "failed", "cancelled"];

export interface WorkHistoryEntry {
  at: number;
  state: WorkState;
  by: string;
  note?: string;
}

export interface WorkJobSummary {
  id: string;
  machine: string;
  plugin: string;
  app?: string;
  name?: string;
  owner?: string;
  by?: string;
  state: WorkState;
  created?: number;
  started?: number | null;
  finished?: number | null;
  done?: number;
  total?: number;
  percent?: number;
  message?: string;
  /** The place among the queued jobs of its machine (1 is the next); 0 when it is not queued. */
  position?: number;
}

export interface WorkJob extends WorkJobSummary {
  native?: string;
  view?: unknown;
  history?: WorkHistoryEntry[];
}

export interface WorkJobPage {
  total: number;
  offset: number;
  limit: number;
  items: WorkJobSummary[];
}

export interface NewWorkJob {
  machine: string;
  request: Record<string, unknown>;
  name?: string;
  app?: string;
}

export interface WorkNotification {
  id: number;
  at?: number;
  kind: string;
  title: string;
  data?: Record<string, unknown>;
  read: boolean;
}

/** The second version of the request of a drilling or routing job: where each tool sits in the bar of the tool changer (docs/ATC_CHAIN.md of EH3D-SERVER). */
export interface RackSlot {
  tool: number;
  place: number;
}

export interface JobRackV2 {
  first?: number;
  carry_in?: boolean;
  carry_out?: boolean;
  slots?: RackSlot[];
  carry_slot?: number;
}

// ---- the single login

export interface AuthClaims {
  name: string;
  role: Role;
  is_token: boolean;
  app?: string | null;
  session_id?: string | null;
  created?: number | null;
  last_seen?: number | null;
  expires?: number | null;
  token_id?: string | null;
  template?: string | null;
  scopes?: string[] | null;
}

export interface AuthSession {
  id: string;
  name: string;
  role: Role;
  app: string;
  created: number;
  last_seen?: number;
  expires: number;
  ip?: string;
  current: boolean;
}

export interface AuthPolicySwitch {
  key: string;
  value: unknown;
  safe: boolean;
}

export interface AuthPolicy {
  switches: AuthPolicySwitch[];
  /** The keys that are looser than the recommended value. */
  attention: string[];
  extra_apps: string[];
}

export interface AuthApps {
  apps: string[];
  known_only: boolean;
}
