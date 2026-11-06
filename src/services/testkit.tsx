/* What the tests of the common services share: a server that answers from a table of routes, an EventSource that the test drives by hand, and the context a page needs. Not part of
 * the application. GPL-3.0-or-later. */
import type { ReactNode } from "react";
import { AppContext } from "../context";
import type { AppState } from "../context";
import { makeErr, makeText } from "../context";
import type { Api } from "../api";
import type { Role } from "../types";
import { AuthClient } from "./authsvc";
import { EventFeed } from "./events";
import type { SourceLike } from "./events";
import { ServiceHttp } from "./http";
import { can } from "./permissions";
import type { Who } from "./permissions";
import { ServicesContext } from "./context";
import type { ServicesState } from "./context";
import { StoreClient } from "./store";
import type { AuthClaims } from "./types";
import { WorkClient } from "./work";

export interface Call {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}

export type Handler = (call: Call) => Response | Promise<Response> | unknown;

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...headers } });
}

export function refusal(status: number, error: string, detail = ""): Response {
  return json({ error, detail }, status);
}

/** A fetch that answers from `routes` (`"GET /apps/studio/projects"`); a route that is not there is a 404 `unknown_route`. The calls are kept in `calls`. */
export function fakeServer(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const fetcher = async (input: string, init?: RequestInit): Promise<Response> => {
    const url = new URL(input, "http://server");
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/api\/v1/, "");
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries((init?.headers ?? {}) as Record<string, string>)) headers[k.toLowerCase()] = v;
    let body: unknown = init?.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        /* a text body */
      }
    }
    const call: Call = { method, path, query: url.searchParams, headers, body };
    calls.push(call);
    const handler = routes[`${method} ${path}`];
    if (!handler) return refusal(404, "unknown_route", `${method} ${path}`);
    const out = await handler(call);
    return out instanceof Response ? out : json(out);
  };
  return { fetcher, calls };
}

/** An EventSource that a test fills: `emit` delivers an event to the listener of its name. */
export class FakeSource implements SourceLike {
  static all: FakeSource[] = [];
  onerror: ((e: Event) => void) | null = null;
  closed = false;
  private listeners = new Map<string, ((e: MessageEvent) => void)[]>();
  constructor(readonly url: string) {
    FakeSource.all.push(this);
  }
  addEventListener(type: string, listener: (e: MessageEvent) => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }
  close(): void {
    this.closed = true;
  }
  emit(type: string, data: unknown, id?: number): void {
    const e = { data: JSON.stringify(data), lastEventId: id === undefined ? "" : String(id) } as MessageEvent;
    for (const l of this.listeners.get(type) ?? []) l(e);
  }
  fail(): void {
    this.onerror?.(new Event("error"));
  }
  static reset(): void {
    FakeSource.all = [];
  }
}

export function makeApp(role: Role, name = "ana"): AppState {
  return {
    api: {} as Api,
    session: { name, role, is_token: false },
    lang: "en",
    theme: "forge",
    refreshS: 0,
    alerts: false,
    t: makeText("en"),
    err: makeErr("en"),
    say: () => undefined,
  };
}

export function makeServices(fetcher: (input: string, init?: RequestInit) => Promise<Response>, role: Role, claims: AuthClaims | null = null): ServicesState {
  const http = new ServiceHttp(() => "tok", fetcher, { retries: 0 }, async () => undefined);
  const who: Who = { role, scopes: claims?.scopes ?? null };
  const stores = new Map<string, StoreClient>();
  const feed = new EventFeed({ open: (url) => new FakeSource(url), ticket: async () => "t1" });
  return {
    http,
    auth: new AuthClient(http),
    work: new WorkClient(http),
    store: (app) => {
      let c = stores.get(app);
      if (!c) {
        c = new StoreClient(http, app);
        stores.set(app, c);
      }
      return c;
    },
    claims,
    who,
    allowed: (a) => can(who, a),
    acquireFeed: () => () => undefined,
    feed,
  };
}

export function Providers({ app, services, children }: { app: AppState; services: ServicesState; children: ReactNode }) {
  return (
    <AppContext.Provider value={app}>
      <ServicesContext.Provider value={services}>{children}</ServicesContext.Provider>
    </AppContext.Provider>
  );
}
