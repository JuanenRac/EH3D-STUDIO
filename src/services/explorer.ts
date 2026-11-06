/*
 * The state of the explorer of the project store, as a reducer: what is loaded (with its states of loading, ready and error), what is chosen, the conflict that the last write
 * left, and the folders that are collapsed. It has no page in it, so a test drives it with actions. GPL-3.0-or-later.
 */
import type { ProjectOrder, WriteProblem } from "./store";
import type { StoreProject, StoreProjectSummary, StoreVersion } from "./types";

export interface Remote<T> {
  status: "idle" | "loading" | "ready" | "error";
  data: T | null;
  error: unknown;
}

export const IDLE: Remote<never> = { status: "idle", data: null, error: null };

export type RemoteAction<T> = { type: "load" } | { type: "ok"; data: T } | { type: "fail"; error: unknown } | { type: "reset" };

/** A request in flight keeps what was loaded before (the page does not blink); a failure keeps it too and says what failed. */
export function remoteReducer<T>(state: Remote<T>, action: RemoteAction<T>): Remote<T> {
  switch (action.type) {
    case "load":
      return { status: "loading", data: state.data, error: null };
    case "ok":
      return { status: "ready", data: action.data, error: null };
    case "fail":
      return { status: "error", data: state.data, error: action.error };
    case "reset":
      return { status: "idle", data: null, error: null };
  }
}

/** What a refused write leaves for the page to say: which file, and why. */
export interface ConflictNotice {
  problem: WriteProblem;
  name: string;
  detail: string;
}

export interface ExplorerState {
  projects: Remote<StoreProjectSummary[]>;
  total: number;
  selected: string | null;
  detail: Remote<StoreProject>;
  file: string | null;
  versions: Remote<StoreVersion[]>;
  conflict: ConflictNotice | null;
  collapsed: string[];
  query: string;
  tag: string;
  mine: boolean;
  order: ProjectOrder;
}

export const INITIAL_EXPLORER: ExplorerState = {
  projects: IDLE,
  total: 0,
  selected: null,
  detail: IDLE,
  file: null,
  versions: IDLE,
  conflict: null,
  collapsed: [],
  query: "",
  tag: "",
  mine: false,
  order: "updated",
};

export type ExplorerAction =
  | { type: "projects_load" }
  | { type: "projects_ok"; items: StoreProjectSummary[]; total: number }
  | { type: "projects_fail"; error: unknown }
  | { type: "select"; id: string | null }
  | { type: "detail"; action: RemoteAction<StoreProject> }
  | { type: "file"; name: string | null }
  | { type: "versions"; action: RemoteAction<StoreVersion[]> }
  | { type: "conflict"; notice: ConflictNotice | null }
  | { type: "toggle_folder"; path: string }
  | { type: "expand_all" }
  | { type: "query"; query: string }
  | { type: "tag"; tag: string }
  | { type: "mine"; mine: boolean }
  | { type: "order"; order: ProjectOrder };

export function explorerReducer(s: ExplorerState, a: ExplorerAction): ExplorerState {
  switch (a.type) {
    case "projects_load":
      return { ...s, projects: remoteReducer(s.projects, { type: "load" }) };
    case "projects_ok":
      return { ...s, projects: remoteReducer(s.projects, { type: "ok", data: a.items }), total: a.total };
    case "projects_fail":
      return { ...s, projects: remoteReducer(s.projects, { type: "fail", error: a.error }) };
    case "select":
      // another project: what belonged to the old one goes away
      if (a.id === s.selected) return s;
      return { ...s, selected: a.id, detail: IDLE, file: null, versions: IDLE, conflict: null, collapsed: [] };
    case "detail":
      return { ...s, detail: remoteReducer<StoreProject>(s.detail, a.action) };
    case "file":
      if (a.name === s.file) return s;
      return { ...s, file: a.name, versions: IDLE };
    case "versions":
      return { ...s, versions: remoteReducer<StoreVersion[]>(s.versions, a.action) };
    case "conflict":
      return { ...s, conflict: a.notice };
    case "toggle_folder":
      return { ...s, collapsed: s.collapsed.includes(a.path) ? s.collapsed.filter((p) => p !== a.path) : [...s.collapsed, a.path] };
    case "expand_all":
      return { ...s, collapsed: [] };
    case "query":
      return { ...s, query: a.query };
    case "tag":
      return { ...s, tag: s.tag === a.tag ? "" : a.tag };
    case "mine":
      return { ...s, mine: a.mine };
    case "order":
      return { ...s, order: a.order };
  }
}
