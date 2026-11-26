/*
 * The nodes of the pick-and-place machines (`/api/v1/pnp/nodes`; docs/API.md of EH3D-SERVER): the client, the rules the panel decides with and the websocket event that says a node
 * changed. The server keeps the list, asks each node on a timer and degrades towards what is safer; Studio never reaches a node by itself, and the token of a node never comes
 * back from the server (it is `********`). Everything that was seen here was seen against a simulator: nothing has run on a real feeder or head. GPL-3.0-or-later.
 */
import { validAddress } from "../model";
import type { TextKey } from "../i18n";
import type { ServiceHttp } from "./http";

export type PnpKind = "feeder" | "head";

/** The mark the server puts where a token is: it means "there is one" and sent back it means "keep it". */
export const TOKEN_MARK = "********";

export const PNP_KINDS: readonly PnpKind[] = ["feeder", "head"];

export const PNP_HEALTHS = ["unknown", "disabled", "ok", "warn", "fail", "safe", "unreachable", "refused", "silent"] as const;
export type PnpHealth = (typeof PNP_HEALTHS)[number];

/** What a node said last: only the keys of its contract, with their sizes bound by the server. */
export interface PnpStatus {
  safe?: boolean;
  selfcheck?: string;
  safe_reason?: string;
  slots?: number;
  online?: number;
  bus?: string;
  low?: number;
  empty?: number;
  faulted?: number;
  nozzle_count?: number;
  pump?: boolean;
  xy_clear?: boolean;
  calibrated?: boolean;
  [key: string]: unknown;
}

export interface PnpNode {
  id: string;
  kind: PnpKind;
  name: string;
  address: string;
  /** `********` when the node has a token, empty when it has none. */
  token: string;
  machine: string;
  enabled: boolean;
  health: PnpHealth | string;
  ready: boolean;
  silent_for_s?: number | null;
  polls: { ok: number; failed: number };
  last_error: string;
  status: PnpStatus | null;
  evidence: string;
  simulator_only?: boolean;
  /** Milliseconds without being asked after which the node goes to its safe state: what it says, else the default of its contract. Absent from an older server. */
  link_lost_ms?: number;
  /** Whether `link_lost_ms` is what the node said (false: the default of its contract). */
  link_lost_declared?: boolean;
  /** The server asks it every `pnp_node_poll_s`, which is that time or more. */
  poll_too_slow?: boolean;
}

/** A warning of the list of the nodes; the only code today is `poll_too_slow`. */
export interface PnpWarning {
  code: string;
  node: string;
  poll_s: number;
  link_lost_ms: number;
  link_lost_declared: boolean;
}

export interface PnpLimits {
  max: number;
  poll_s: number;
  silence_s: number;
  timeout_s: number;
  kinds: string[];
}

export interface PnpList {
  nodes: PnpNode[];
  summary: { registered?: number; ready?: number; not_ready?: number; by_health?: Record<string, number> };
  limits: PnpLimits;
  /** Absent from an older server. */
  warnings?: PnpWarning[];
}

/** The warnings of a node asked too slowly that can be read; an answer without them, or with something else in their place, has none. */
export function slowWarnings(list: { warnings?: unknown } | null | undefined): PnpWarning[] {
  const all = list?.warnings;
  if (!Array.isArray(all)) return [];
  return (all as Partial<PnpWarning>[]).filter(
    (w): w is PnpWarning => !!w && w.code === "poll_too_slow" && typeof w.node === "string" && typeof w.poll_s === "number" && typeof w.link_lost_ms === "number",
  );
}

export interface NewPnpNode {
  kind: PnpKind;
  name: string;
  address: string;
  id?: string;
  token?: string;
  machine?: string;
  enabled?: boolean;
}

export interface PnpNodeChange {
  name?: string;
  address?: string;
  token?: string;
  machine?: string;
  enabled?: boolean;
}

export class PnpClient {
  constructor(private http: ServiceHttp) {}

  list = () => this.http.json<PnpList>("GET", "/pnp/nodes");
  get = (id: string) => this.http.json<PnpNode>("GET", `/pnp/nodes/${encodeURIComponent(id)}`);
  add = (n: NewPnpNode) => this.http.json<PnpNode>("POST", "/pnp/nodes", { json: n });
  change = (id: string, c: PnpNodeChange) => this.http.json<PnpNode>("PUT", `/pnp/nodes/${encodeURIComponent(id)}`, { json: c });
  remove = (id: string) => this.http.json<unknown>("DELETE", `/pnp/nodes/${encodeURIComponent(id)}`);
  /** Asks the node now (an operator): the answer is the node as the server sees it. */
  poll = (id: string) => this.http.json<PnpNode>("POST", `/pnp/nodes/${encodeURIComponent(id)}/poll`, { json: {} });
}

// ---- health

/** Only `ok` and `warn` are ready; every other health is not (the safe way). */
export function isReadyHealth(health: string): boolean {
  return health === "ok" || health === "warn";
}

export function healthTone(health: string): "ok" | "run" | "wait" | "bad" | "dim" {
  if (health === "ok") return "ok";
  if (health === "warn") return "wait";
  if (health === "unknown" || health === "disabled") return "dim";
  return "bad";
}

/** The text of a health; a health a newer server may add keeps its own word. */
export function healthText(health: string): TextKey | null {
  return (PNP_HEALTHS as readonly string[]).includes(health) ? (`pnp_health_${health}` as TextKey) : null;
}

/** The numbers a person reads in the list of a node, from what the node said last. */
export function nodeFacts(node: Pick<PnpNode, "kind" | "status">): { key: TextKey; vars: Record<string, number>; pump: boolean | null } | null {
  const s = node.status;
  if (!s) return null;
  const n = (v: unknown): number => (typeof v === "number" ? v : 0);
  if (node.kind === "feeder") return { key: "pnp_facts_feeder", vars: { online: n(s.online), slots: n(s.slots), low: n(s.low), empty: n(s.empty), faulted: n(s.faulted) }, pump: null };
  return { key: "pnp_facts_head", vars: { nozzles: n(s.nozzle_count), faulted: n(s.faulted) }, pump: typeof s.pump === "boolean" ? s.pump : null };
}

export function countReady(nodes: readonly Pick<PnpNode, "ready" | "enabled">[]): { registered: number; ready: number; notReady: number } {
  const ready = nodes.filter((n) => n.ready).length;
  return { registered: nodes.length, ready, notReady: nodes.length - ready };
}

// ---- who may do what

/** Registering, changing and removing a node is for an administrator (`machines:manage`); asking a node now is for an operator (`jobs:prepare`). */
export function nodeActions(allowed: (a: "machines.manage" | "jobs.prepare") => boolean, node: Pick<PnpNode, "enabled">): ("poll" | "edit" | "remove")[] {
  const out: ("poll" | "edit" | "remove")[] = [];
  if (allowed("jobs.prepare") && node.enabled) out.push("poll");
  if (allowed("machines.manage")) out.push("edit", "remove");
  return out;
}

// ---- the form of a node

export interface NodeForm {
  kind: PnpKind;
  id: string;
  name: string;
  address: string;
  /** Typed token; empty keeps the token a node has (and adds none to a new node). */
  token: string;
  machine: string;
  enabled: boolean;
}

export const EMPTY_NODE_FORM: NodeForm = { kind: "feeder", id: "", name: "", address: "", token: "", machine: "", enabled: true };

export function formOf(node: PnpNode): NodeForm {
  return { kind: node.kind, id: node.id, name: node.name, address: node.address, token: "", machine: node.machine, enabled: node.enabled };
}

export type FormProblem = "id" | "name" | "address" | "token";

/** What is wrong with the form before anything is sent: the server judges again. */
export function formProblems(f: NodeForm, editing: boolean): FormProblem[] {
  const out: FormProblem[] = [];
  if (!editing && f.id !== "" && !/^[a-z0-9][a-z0-9-]{0,31}$/.test(f.id)) out.push("id");
  if (f.name.trim() === "" || [...f.name].length > 64 || hasControl(f.name)) out.push("name");
  if (!validAddress(f.address.trim()) || hasControl(f.address) || f.address.includes("@")) out.push("address");
  if (f.token.length > 200 || /\s/u.test(f.token) || hasControl(f.token)) out.push("token");
  return out;
}

function hasControl(s: string): boolean {
  for (const c of s) {
    const code = c.charCodeAt(0);
    if (code < 32 || code === 127) return true;
  }
  return false;
}

export const PROBLEM_TEXT: Record<FormProblem, TextKey> = { id: "pnp_err_id", name: "pnp_err_name", address: "pnp_err_address", token: "pnp_err_token" };

export function newBody(f: NodeForm): NewPnpNode {
  const body: NewPnpNode = { kind: f.kind, name: f.name.trim(), address: f.address.trim(), enabled: f.enabled };
  if (f.id !== "") body.id = f.id;
  if (f.token !== "") body.token = f.token;
  if (f.machine !== "") body.machine = f.machine;
  return body;
}

/** The change of a node: a token left empty is sent as the mark, which the server reads as "keep it". */
export function changeBody(f: NodeForm): PnpNodeChange {
  return { name: f.name.trim(), address: f.address.trim(), token: f.token === "" ? TOKEN_MARK : f.token, machine: f.machine, enabled: f.enabled };
}

// ---- the event of the websocket

/** The event `{"type":"pnp_node","id","health","ready"}`; null for any other message. */
export function nodeEvent(raw: string): { id: string; health: string; ready: boolean } | null {
  try {
    const v = JSON.parse(raw) as { type?: unknown; id?: unknown; health?: unknown; ready?: unknown };
    if (v.type !== "pnp_node" || typeof v.id !== "string") return null;
    return { id: v.id, health: typeof v.health === "string" ? v.health : "unknown", ready: v.ready === true };
  } catch {
    return null;
  }
}

/** The list after an event: the node it names takes the new health and readiness at once (the list is asked for again after). */
export function applyNodeEvent(nodes: readonly PnpNode[], e: { id: string; health: string; ready: boolean }): PnpNode[] {
  return nodes.map((n) => (n.id === e.id ? { ...n, health: e.health, ready: e.ready } : n));
}

export interface SocketLike {
  onopen: (() => void) | null;
  onmessage: ((m: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  close(): void;
}

export interface SocketDeps {
  ticket: () => Promise<string>;
  open: (ticket: string) => SocketLike;
  /** Calls `fn` after `ms` milliseconds; returns a function that cancels it. */
  later?: (fn: () => void, ms: number) => () => void;
}

/** One connection to the websocket of the server that listens for `pnp_node` and mends itself: 1 s, 2 s, 4 s... up to 30 s. */
export class NodeSocket {
  private socket: SocketLike | null = null;
  private cancel: (() => void) | null = null;
  private attempt = 0;
  private running = false;
  private generation = 0;

  constructor(
    private deps: SocketDeps,
    private onEvent: (e: { id: string; health: string; ready: boolean }) => void,
    private onStatus: (live: boolean) => void = () => undefined,
  ) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.attempt = 0;
    void this.connect();
  }

  stop(): void {
    this.running = false;
    this.generation++;
    this.cancel?.();
    this.cancel = null;
    this.socket?.close();
    this.socket = null;
    this.onStatus(false);
  }

  private async connect(): Promise<void> {
    const mine = ++this.generation;
    let ticket: string;
    try {
      ticket = await this.deps.ticket();
    } catch {
      if (mine === this.generation && this.running) this.again();
      return;
    }
    if (mine !== this.generation || !this.running) return;
    let socket: SocketLike;
    try {
      socket = this.deps.open(ticket);
    } catch {
      this.again();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      if (mine !== this.generation) return;
      this.attempt = 0;
      this.onStatus(true);
    };
    socket.onmessage = (m) => {
      if (mine !== this.generation) return;
      const e = nodeEvent(String(m.data));
      if (e) this.onEvent(e);
    };
    socket.onclose = () => {
      if (mine !== this.generation) return;
      this.socket = null;
      this.again();
    };
  }

  private again(): void {
    this.onStatus(false);
    if (!this.running) return;
    this.attempt = Math.min(this.attempt + 1, 6);
    const later = this.deps.later ?? ((fn, ms) => {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    });
    this.cancel = later(() => {
      this.cancel = null;
      if (this.running) void this.connect();
    }, Math.min(30000, 1000 * 2 ** (this.attempt - 1)));
  }
}
