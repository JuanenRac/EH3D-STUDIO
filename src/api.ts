/*
 * The client of the API of EH3D-SERVER (docs/API.md of that repository). One class, one method per request, and one kind of error: the server answers a refusal as
 * `{ "error": code, "detail": text }` with a status, and that is what an ApiError carries. The pages never build a URL by hand.
 * Copyright (C) 2026 JuanenRac (Electro Hobby 3D). GPL-3.0-or-later.
 */
import type { Fleet, HeadInspection, HeadLight, HeadMeasure, HeadStatus, Health, Job, JobView, JobSummary, Machine, MachineInput, NewToken, Role, SavedRequest, Session, SpindleGuard, SpindleId, SpindleView, TokenInfo, UpdatesView, UserInfo } from "./types";

export class ApiError extends Error {
  constructor(public status: number, public code: string, public detail: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const BASE = "/api/v1";

/** The application Studio says it logs in for (`POST /auth/login`): the server keeps it with the login and in the audit. */
export const LOGIN_APP = "studio";

/** How long a request may take before it is given up, in milliseconds: the health check is short (it is what says whether the server answers at all), the planning of a big file is long. */
export type Timeouts = { normal: number; health: number; long: number };
export const DEFAULT_TIMEOUTS: Timeouts = { normal: 15000, health: 5000, long: 60000 };

export class Api {
  /** The login token of this person (kept by the application, never by this class). */
  token: string | null;
  private fetcher: Fetcher;
  private timeouts: Timeouts;

  constructor(token: string | null = null, fetcher?: Fetcher, timeouts: Partial<Timeouts> = {}) {
    this.token = token;
    this.fetcher = fetcher ?? ((input, init) => fetch(input, init));
    this.timeouts = { ...DEFAULT_TIMEOUTS, ...timeouts };
  }

  /** What the clients of the common services (src/services) need to talk to the same server: the token as it is at each request, the transport and the time limits. */
  transport(): { token: () => string | null; fetcher: Fetcher; timeouts: Timeouts } {
    return { token: () => this.token, fetcher: this.fetcher, timeouts: this.timeouts };
  }

  /** A request that gets no answer in time ends as the error `timeout`, and the request in flight is cancelled; a server that accepts the connection and then says nothing must not hold the page. */
  private async request<T>(method: string, path: string, body?: unknown, long = false): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const limit = path === "/health" ? this.timeouts.health : long ? this.timeouts.long : this.timeouts.normal;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ApiError(0, "timeout", `${limit} ms`));
      }, limit);
    });
    let response: Response;
    let text: string;
    try {
      const answer = async () => {
        const r = await this.fetcher(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal });
        return [r, await r.text()] as const;
      };
      [response, text] = await Promise.race([answer(), late]);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(0, controller.signal.aborted ? "timeout" : "unreachable", e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }
    }
    if (!response.ok) {
      const e = (data ?? {}) as { error?: string; detail?: string };
      throw new ApiError(response.status, e.error ?? `http_${response.status}`, e.detail ?? "");
    }
    return data as T;
  }

  // ---- who is who
  health = () => this.request<Health>("GET", "/health");
  setupNeeded = async () => (await this.request<{ needed: boolean }>("GET", "/setup")).needed;
  setup = (code: string, name: string, password: string) => this.request<unknown>("POST", "/setup", { code, name, password });
  login = async (name: string, password: string) => {
    const r = await this.request<{ token: string; name: string; role: Role; expires_s: number; app?: string; session_id?: string }>("POST", "/auth/login", { name, password, app: LOGIN_APP });
    this.token = r.token;
    return r;
  };
  logout = async () => {
    try {
      await this.request<unknown>("POST", "/logout");
    } finally {
      this.token = null;
    }
  };
  session = () => this.request<Session>("GET", "/session");
  changePassword = (oldPassword: string, newPassword: string) => this.request<unknown>("PUT", "/account", { old: oldPassword, new: newPassword });

  // ---- users and tokens
  users = () => this.request<UserInfo[]>("GET", "/users");
  addUser = (name: string, role: Role, password: string) => this.request<unknown>("POST", "/users", { name, role, password });
  updateUser = (name: string, change: { role?: Role; password?: string; disabled?: boolean }) =>
    this.request<unknown>("PUT", `/users/${encodeURIComponent(name)}`, change);
  deleteUser = (name: string) => this.request<unknown>("DELETE", `/users/${encodeURIComponent(name)}`);
  tokens = () => this.request<TokenInfo[]>("GET", "/tokens");
  /** With `days` the token stops working after them (1 to 3650); without, it takes the server's default (which is no expiry unless `token_default_days` says otherwise). */
  addToken = (name: string, role: Role, days?: number) => this.request<NewToken>("POST", "/tokens", days === undefined ? { name, role } : { name, role, days });
  deleteToken = (id: string) => this.request<unknown>("DELETE", `/tokens/${encodeURIComponent(id)}`);

  // ---- machines and the fleet
  machines = () => this.request<Machine[]>("GET", "/machines");
  addMachine = (m: MachineInput) => this.request<Machine>("POST", "/machines", m);
  updateMachine = (id: string, m: MachineInput) => this.request<Machine>("PUT", `/machines/${encodeURIComponent(id)}`, m);
  deleteMachine = (id: string) => this.request<unknown>("DELETE", `/machines/${encodeURIComponent(id)}`);
  fleet = () => this.request<Fleet>("GET", "/fleet");

  /** The spindle of a machine (a viewer reads it) and its change (an administrator): `original` and `vfd` take the limits that differ from the starting ones. */
  spindle = (machine: string) => this.request<SpindleView>("GET", `/machines/${encodeURIComponent(machine)}/spindle`);
  setSpindle = (machine: string, change: { spindle?: SpindleId | ""; guard?: SpindleGuard }) =>
    this.request<SpindleView>("PUT", `/machines/${encodeURIComponent(machine)}/spindle`, change);

  // ---- jobs
  jobs = (filter: { machine?: string; state?: string } = {}) => {
    const q = new URLSearchParams();
    if (filter.machine) q.set("machine", filter.machine);
    if (filter.state) q.set("state", filter.state);
    const s = q.toString();
    return this.request<JobSummary[]>("GET", "/jobs" + (s ? `?${s}` : ""));
  };
  job = (id: string) => this.request<Job>("GET", `/jobs/${encodeURIComponent(id)}`);
  previewJob = (machine: string, request: unknown) => this.request<JobView>("POST", `/machines/${encodeURIComponent(machine)}/preview`, request, true);
  createJob = (machine: string, request: unknown) => this.request<Job>("POST", `/machines/${encodeURIComponent(machine)}/jobs`, request, true);
  startJob = (id: string) => this.request<unknown>("POST", `/jobs/${encodeURIComponent(id)}/start`, {}, true);
  confirmJob = (id: string) => this.request<unknown>("POST", `/jobs/${encodeURIComponent(id)}/confirm`, {});
  cancelJob = (id: string) => this.request<unknown>("POST", `/jobs/${encodeURIComponent(id)}/cancel`, {});
  deleteJob = (id: string) => this.request<unknown>("DELETE", `/jobs/${encodeURIComponent(id)}`);
  /** Hold a running G-code job (the controller holds its movement) and let it go on: the resume also answers the wait of a job that goes on after a stop. */
  pauseJob = (id: string) => this.request<unknown>("POST", `/jobs/${encodeURIComponent(id)}/pause`, {});
  resumeJob = (id: string) => this.request<unknown>("POST", `/jobs/${encodeURIComponent(id)}/resume`, {});
  /** What was asked of a job as it came, and where a stopped one should go on from (`next_skip`). */
  jobRequest = (id: string) => this.request<SavedRequest>("GET", `/jobs/${encodeURIComponent(id)}/request`);
  /** A new job, ready and not started, from the saved request of a cancelled or failed one with the work done left out: the file is not asked for again. */
  resumeFrom = (id: string, change: { skip?: number; skip_tools?: number[]; restore_outputs?: boolean; name?: string } = {}) =>
    this.request<Job>("POST", `/jobs/${encodeURIComponent(id)}/resume-from`, change, true);

  // ---- the node of the drill head, through the server
  headStatus = (machine: string) => this.request<HeadStatus>("GET", `/machines/${encodeURIComponent(machine)}/head/status`);
  headMeasure = (machine: string, samples = 0) =>
    this.request<HeadMeasure>("POST", `/machines/${encodeURIComponent(machine)}/head/measure${samples > 0 ? `?samples=${samples}` : ""}`, {});
  /** The ring of LEDs of the head: read it (a viewer) and change it (an operator; the server hands on the answer of the node). */
  headLight = (machine: string) => this.request<HeadLight>("GET", `/machines/${encodeURIComponent(machine)}/head/light`);
  setHeadLight = (machine: string, change: { on?: boolean; level?: number; tone?: string }) => {
    const q = new URLSearchParams();
    if (change.on !== undefined) q.set("on", change.on ? "1" : "0");
    if (change.level !== undefined) q.set("level", String(Math.max(0, Math.min(100, Math.round(change.level)))));
    if (change.tone !== undefined) q.set("tone", change.tone);
    return this.request<HeadLight>("POST", `/machines/${encodeURIComponent(machine)}/head/light?${q.toString()}`, {});
  };
  /** The last quality check of the machine (404 `no_inspection` until one is made after the server starts). */
  headInspection = (machine: string) => this.request<HeadInspection>("GET", `/machines/${encodeURIComponent(machine)}/head/inspect`);
  /** A ticket for the camera or the websocket, good for one use within half a minute: the address carries it instead of the token of the session. */
  ticket = () => this.request<{ ticket: string; expires_s: number }>("POST", "/tickets", {});
  /** The address of the camera picture of the node: a picture cannot carry a header, so the address carries a ticket. */
  headStreamUrl = (machine: string, ticket: string) => `${BASE}/machines/${encodeURIComponent(machine)}/head/stream?ticket=${encodeURIComponent(ticket)}`;
  /** The stop button: ends the job that is active on the machine at once, whichever it is (the server reaches the machine without waiting for the line it is sending). */
  stopMachine = (machine: string) => this.request<{ ok: boolean; stopped: boolean; job: string | null }>("POST", `/machines/${encodeURIComponent(machine)}/stop`, {});

  // ---- the updates of the installed services, from the releases of GitHub (administrator)
  updates = () => this.request<UpdatesView>("GET", "/updates");
  checkUpdates = () => this.request<unknown>("POST", "/updates/check", {});
  applyUpdates = (components: string[]) => this.request<unknown>("POST", "/updates/apply", { components });
  /** Puts back the version that the last update of those services left behind. */
  undoUpdates = (components: string[]) => this.request<unknown>("POST", "/updates/undo", { components });
  /** Empties the list of the jobs that the update helper did before. */
  clearUpdateHistory = () => this.request<unknown>("POST", "/updates/clear-history", {});

  /** The address of the websocket of the events: a browser cannot set a header on a websocket, so the address carries a ticket. */
  eventsUrl(location: { protocol: string; host: string }, ticket: string): string {
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    return `${scheme}//${location.host}${BASE}/events?ticket=${encodeURIComponent(ticket)}`;
  }
}
