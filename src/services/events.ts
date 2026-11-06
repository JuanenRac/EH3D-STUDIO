/*
 * The stream of events of the server (`GET /api/v1/events/stream`, server-sent events; docs/MACHINE_PLUGINS.md of EH3D-SERVER). An EventSource cannot set a header, so each
 * connection asks for a one-use ticket and carries it in the address; when the connection ends the feed asks for a new ticket, waits (a longer time each failure, up to a
 * limit) and connects again with `last_event_id`, so the server hands over what was missed. A `hello` that says `resync` tells the page to ask for the state again. The
 * EventSource and the clock are given by the caller, so the tests use a false one. Everything the pages decide with (the filters, the list kept) is a pure function.
 * Copyright (C) 2026 JuanenRac (Electro Hobby 3D). GPL-3.0-or-later.
 */
import { API_BASE } from "./http";

/** The kinds of event the server tells (a named event is only heard by a listener for its name). */
export const FEED_KINDS = [
  "project.created",
  "project.changed",
  "project.removed",
  "project.file",
  "project.file_removed",
  "project.locked",
  "project.unlocked",
  "job.created",
  "job.state",
  "job.progress",
  "machine.created",
  "machine.changed",
  "machine.removed",
  "catalog.changed",
  "notification",
  "resync",
] as const;

export interface FeedEvent {
  id: number;
  kind: string;
  machine?: string | null;
  project?: string | null;
  job?: string | null;
  app?: string | null;
  data?: unknown;
}

export interface FeedHello {
  last_id: number;
  resumed: boolean;
  resync: boolean;
  clients: number;
}

export type FeedStatus = "idle" | "connecting" | "live" | "reconnecting" | "failed" | "stopped";

/** The part of an EventSource the feed uses. */
export interface SourceLike {
  addEventListener(type: string, listener: (e: MessageEvent) => void): void;
  close(): void;
  onerror: ((e: Event) => void) | null;
}

export type SourceFactory = (url: string) => SourceLike;

export interface FeedDeps {
  open: SourceFactory;
  /** A one-use ticket for the address of the stream. */
  ticket: () => Promise<string>;
  /** Calls `fn` after `ms` milliseconds; returns a function that cancels it. */
  later?: (fn: () => void, ms: number) => () => void;
  /** After how many failures in a row the feed stops trying by itself. */
  maxAttempts?: number;
}

export interface FeedListener {
  onStatus?: (status: FeedStatus, attempt: number) => void;
  onEvent?: (event: FeedEvent) => void;
  onHello?: (hello: FeedHello) => void;
  /** The server could not keep the events the page missed: ask for the state again. */
  onResync?: () => void;
}

/** The wait before the try number `attempt` (0 the first): 1 s, 2 s, 4 s... up to 30 s. */
export function backoffMs(attempt: number): number {
  return Math.min(30000, 1000 * 2 ** Math.max(0, attempt));
}

/** The address of the stream for a ticket, with the number of the last event heard and the filters of the server. */
export function streamUrl(ticket: string, lastId: number | null, filters: { machine?: string; project?: string; job?: string; app?: string; kinds?: string[] } = {}): string {
  const q = new URLSearchParams();
  q.set("ticket", ticket);
  if (lastId !== null) q.set("last_event_id", String(lastId));
  if (filters.machine) q.set("machine", filters.machine);
  if (filters.project) q.set("project", filters.project);
  if (filters.job) q.set("job", filters.job);
  if (filters.app) q.set("app", filters.app);
  if (filters.kinds && filters.kinds.length > 0) q.set("kinds", filters.kinds.join(","));
  return `${API_BASE}/events/stream?${q.toString()}`;
}

function parseEvent(raw: string, fallbackId: number): FeedEvent | null {
  try {
    const v = JSON.parse(raw) as Partial<FeedEvent>;
    if (typeof v !== "object" || v === null || typeof v.kind !== "string") return null;
    return { ...v, kind: v.kind, id: typeof v.id === "number" ? v.id : fallbackId };
  } catch {
    return null;
  }
}

/** One connection to the stream that mends itself. */
export class EventFeed {
  private source: SourceLike | null = null;
  private cancelWait: (() => void) | null = null;
  private lastId: number | null = null;
  private attempt = 0;
  private running = false;
  private status: FeedStatus = "idle";
  private generation = 0;
  private listeners = new Set<FeedListener>();

  constructor(
    private deps: FeedDeps,
    private filters: { machine?: string; project?: string; job?: string; app?: string; kinds?: string[] } = {},
  ) {}

  subscribe(listener: FeedListener): () => void {
    this.listeners.add(listener);
    listener.onStatus?.(this.status, this.attempt);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get state(): { status: FeedStatus; attempt: number; lastId: number | null } {
    return { status: this.status, attempt: this.attempt, lastId: this.lastId };
  }

  private set(status: FeedStatus) {
    this.status = status;
    for (const l of this.listeners) l.onStatus?.(status, this.attempt);
  }

  /** Starts to listen (or tries again after the feed gave up). */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.attempt = 0;
    void this.connect();
  }

  /** Stops listening and cancels any wait. */
  stop(): void {
    this.running = false;
    this.generation++;
    this.cancelWait?.();
    this.cancelWait = null;
    this.source?.close();
    this.source = null;
    this.set("stopped");
  }

  private async connect(): Promise<void> {
    const mine = ++this.generation;
    this.set(this.attempt === 0 ? "connecting" : "reconnecting");
    let ticket: string;
    try {
      ticket = await this.deps.ticket();
    } catch {
      if (mine === this.generation && this.running) this.failed();
      return;
    }
    if (mine !== this.generation || !this.running) return;
    let source: SourceLike;
    try {
      source = this.deps.open(streamUrl(ticket, this.lastId, this.filters));
    } catch {
      this.failed();
      return;
    }
    this.source = source;
    const heard = (e: MessageEvent) => {
      if (mine !== this.generation) return;
      const raw = typeof e.data === "string" ? e.data : "";
      const parsed = parseEvent(raw, Number(e.lastEventId) || (this.lastId ?? 0));
      if (!parsed) return;
      if (typeof e.lastEventId === "string" && e.lastEventId !== "") parsed.id = Number(e.lastEventId) || parsed.id;
      if (this.lastId === null || parsed.id > this.lastId) this.lastId = parsed.id;
      for (const l of this.listeners) l.onEvent?.(parsed);
      if (parsed.kind === "resync") for (const l of this.listeners) l.onResync?.();
    };
    for (const kind of FEED_KINDS) source.addEventListener(kind, heard);
    source.addEventListener("hello", (e: MessageEvent) => {
      if (mine !== this.generation) return;
      try {
        const hello = JSON.parse(String(e.data)) as FeedHello;
        this.attempt = 0;
        this.set("live");
        for (const l of this.listeners) l.onHello?.(hello);
        if (hello.resync) for (const l of this.listeners) l.onResync?.();
        if (typeof hello.last_id === "number" && this.lastId === null) this.lastId = hello.last_id;
      } catch {
        this.set("live");
      }
    });
    source.onerror = () => {
      if (mine !== this.generation) return;
      // the browser would reconnect by itself with a ticket that has been used: close and ask for a new one
      source.close();
      this.source = null;
      this.failed();
    };
  }

  private failed(): void {
    const max = this.deps.maxAttempts ?? 8;
    this.attempt += 1;
    if (this.attempt > max) {
      this.running = false;
      this.set("failed");
      return;
    }
    this.set("reconnecting");
    const later = this.deps.later ?? ((fn, ms) => {
      const id = setTimeout(fn, ms);
      return () => clearTimeout(id);
    });
    this.cancelWait = later(() => {
      this.cancelWait = null;
      if (this.running) void this.connect();
    }, backoffMs(this.attempt - 1));
  }
}

// ---- what the page does with the events

export interface FeedFilter {
  machine: string;
  job: string;
  /** A family (`job`, `project`, `machine`, `catalog`, `notification`) or empty for all. */
  family: string;
}

export function familyOf(kind: string): string {
  const dot = kind.indexOf(".");
  return dot < 0 ? kind : kind.slice(0, dot);
}

export function matchesFeed(e: FeedEvent, f: FeedFilter): boolean {
  if (f.machine && e.machine !== f.machine) return false;
  if (f.job && e.job !== f.job) return false;
  if (f.family && familyOf(e.kind) !== f.family) return false;
  return true;
}

export const FEED_KEEP = 300;

export interface FeedState {
  events: FeedEvent[];
  /** How many events came since the list was last cleared (the list keeps only the latest ones). */
  total: number;
  resyncs: number;
}

export const EMPTY_FEED: FeedState = { events: [], total: 0, resyncs: 0 };

export type FeedAction = { type: "event"; event: FeedEvent } | { type: "clear" } | { type: "resync" };

/** The list keeps the latest events, the newest first, never more than FEED_KEEP; an event it already has (the same number) is not added twice. */
export function feedReducer(state: FeedState, action: FeedAction): FeedState {
  switch (action.type) {
    case "clear":
      return { ...EMPTY_FEED, resyncs: state.resyncs };
    case "resync":
      return { ...state, resyncs: state.resyncs + 1 };
    case "event": {
      if (action.event.kind !== "resync" && state.events.some((e) => e.id === action.event.id && e.kind === action.event.kind)) return state;
      return { ...state, events: [action.event, ...state.events].slice(0, FEED_KEEP), total: state.total + 1 };
    }
  }
}

/** The kinds of the events that make the list of the projects or of the jobs worth asking for again. */
export function affects(e: FeedEvent, what: "projects" | "jobs" | "machines"): boolean {
  const f = familyOf(e.kind);
  if (what === "projects") return f === "project";
  if (what === "jobs") return f === "job" || e.kind === "resync";
  return f === "machine" || e.kind === "resync";
}

/** A line for an event: what happened and to what. */
export function eventLine(e: FeedEvent): string {
  const about = [e.machine, e.project, e.job].filter((x): x is string => typeof x === "string" && x !== "");
  const state = e.data && typeof e.data === "object" && "state" in e.data ? String((e.data as { state: unknown }).state) : "";
  return [e.kind, ...about, state].filter(Boolean).join(" · ");
}
