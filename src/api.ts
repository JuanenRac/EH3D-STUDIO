/*
 * The client of the API of EH3D-SERVER (docs/API.md of that repository). One class, one method per request, and one kind of error: the server answers a refusal as
 * `{ "error": code, "detail": text }` with a status, and that is what an ApiError carries. The pages never build a URL by hand.
 * Copyright (C) 2026 JuanenRac (Electro Hobby 3D). GPL-3.0-or-later.
 */
import type { Fleet, Health, Job, JobSummary, Machine, MachineInput, NewToken, Role, Session, TokenInfo, UpdatesView, UserInfo } from "./types";

export class ApiError extends Error {
  constructor(public status: number, public code: string, public detail: string) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const BASE = "/api/v1";

export class Api {
  /** The login token of this person (kept by the application, never by this class). */
  token: string | null;
  private fetcher: Fetcher;

  constructor(token: string | null = null, fetcher?: Fetcher) {
    this.token = token;
    this.fetcher = fetcher ?? ((input, init) => fetch(input, init));
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers.authorization = `Bearer ${this.token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    let response: Response;
    try {
      response = await this.fetcher(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch (e) {
      throw new ApiError(0, "unreachable", e instanceof Error ? e.message : String(e));
    }
    const text = await response.text();
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
    const r = await this.request<{ token: string; name: string; role: Role; expires_s: number }>("POST", "/login", { name, password });
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
  addToken = (name: string, role: Role) => this.request<NewToken>("POST", "/tokens", { name, role });
  deleteToken = (id: string) => this.request<unknown>("DELETE", `/tokens/${encodeURIComponent(id)}`);

  // ---- machines and the fleet
  machines = () => this.request<Machine[]>("GET", "/machines");
  addMachine = (m: MachineInput) => this.request<Machine>("POST", "/machines", m);
  updateMachine = (id: string, m: MachineInput) => this.request<Machine>("PUT", `/machines/${encodeURIComponent(id)}`, m);
  deleteMachine = (id: string) => this.request<unknown>("DELETE", `/machines/${encodeURIComponent(id)}`);
  fleet = () => this.request<Fleet>("GET", "/fleet");

  // ---- jobs
  jobs = (filter: { machine?: string; state?: string } = {}) => {
    const q = new URLSearchParams();
    if (filter.machine) q.set("machine", filter.machine);
    if (filter.state) q.set("state", filter.state);
    const s = q.toString();
    return this.request<JobSummary[]>("GET", "/jobs" + (s ? `?${s}` : ""));
  };
  job = (id: string) => this.request<Job>("GET", `/jobs/${encodeURIComponent(id)}`);
  startJob = (id: string) => this.request<unknown>("POST", `/jobs/${encodeURIComponent(id)}/start`, {});
  confirmJob = (id: string) => this.request<unknown>("POST", `/jobs/${encodeURIComponent(id)}/confirm`, {});
  cancelJob = (id: string) => this.request<unknown>("POST", `/jobs/${encodeURIComponent(id)}/cancel`, {});
  deleteJob = (id: string) => this.request<unknown>("DELETE", `/jobs/${encodeURIComponent(id)}`);

  // ---- the updates of the installed services, from the releases of GitHub (administrator)
  updates = () => this.request<UpdatesView>("GET", "/updates");
  checkUpdates = () => this.request<unknown>("POST", "/updates/check", {});
  applyUpdates = (components: string[]) => this.request<unknown>("POST", "/updates/apply", { components });

  /** The address of the websocket of the events: the token goes in the address because a browser cannot set a header on a websocket. */
  eventsUrl(location: { protocol: string; host: string }): string {
    const scheme = location.protocol === "https:" ? "wss:" : "ws:";
    return `${scheme}//${location.host}${BASE}/events?token=${encodeURIComponent(this.token ?? "")}`;
  }
}
