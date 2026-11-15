/*
 * A simulated server for the client of the API: a transport (`fetcher`) that answers like EH3D-SERVER from the examples of its answers and fails on purpose when it is
 * told to (the server down, a refusal of the server, a session that expired, a server that accepts the request and says nothing, answers that are not JSON, a link
 * that fails by chance from a seed), so every failure and the recovery can be tried with no server and no machine. Nothing here has talked to a real server or a machine.
 * Copyright (C) 2026 JuanenRac (Electro Hobby 3D). GPL-3.0-or-later.
 */
import fleetExample from "./examples/fleet.json";
import healthExample from "./examples/health.json";
import jobsExample from "./examples/jobs.json";
import sessionExample from "./examples/session.json";

/** What the simulated server does with every request. */
export type SimMode =
  | "up" // answers as the examples do
  | "down" // the connection fails (the server is off or the network is out)
  | "hang" // the connection is made and nothing is ever said (until the request is cancelled)
  | "unavailable" // answers 503 with the error of the server
  | "html" // answers 500 with a page that is not JSON (a proxy in front of the server)
  | "flaky"; // the connection fails by chance, `flakyPerMille` in a thousand, from the seed

/** One request as the simulated server saw it. */
export type SimRequest = { method: string; path: string; authorization: string | null };

/** The password the simulated server accepts. */
export const SIM_PASSWORD = "correct horse";

/** A small deterministic generator (xorshift32). It reads no clock. */
export class SimRng {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }
  /** A number from 0 up to, not including, `n`. */
  below(n: number): number {
    let x = this.state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.state = x;
    return x % n;
  }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export class SimServer {
  mode: SimMode = "up";
  /** In `flaky` mode, the chance in a thousand that a request fails to connect. */
  flakyPerMille = 300;
  /** Every request that reached the server, in order (a request that failed to connect is not in it). */
  requests: SimRequest[] = [];
  /** How many requests were made, those that failed to connect included. */
  attempts = 0;
  private rng: SimRng;
  private tokens = new Set<string>();
  private issued = 0;

  constructor(seed = 1) {
    this.rng = new SimRng(seed);
  }

  /** The server forgets every login (it restarted, or the sessions expired): the tokens given before stop working. */
  expireSessions(): void {
    this.tokens.clear();
  }

  /** The transport to give to the client (`new Api(token, server.fetcher)`). */
  fetcher = (input: string, init?: RequestInit): Promise<Response> => {
    this.attempts += 1;
    if (this.mode === "down" || (this.mode === "flaky" && this.rng.below(1000) < this.flakyPerMille)) {
      return Promise.reject(new TypeError("fetch failed"));
    }
    if (this.mode === "hang") {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      });
    }
    const method = (init?.method ?? "GET").toUpperCase();
    const path = input.replace(/^\/api\/v1/, "").split("?")[0];
    const headers = (init?.headers ?? {}) as Record<string, string>;
    const authorization = headers.authorization ?? null;
    this.requests.push({ method, path, authorization });
    if (this.mode === "unavailable") return Promise.resolve(json(503, { error: "unavailable", detail: "the server is starting" }));
    if (this.mode === "html") return Promise.resolve(new Response("<html><body>Bad gateway</body></html>", { status: 500 }));
    return Promise.resolve(this.answer(method, path, authorization, init?.body));
  };

  private signedIn(authorization: string | null): boolean {
    const m = /^Bearer (.+)$/.exec(authorization ?? "");
    return m !== null && this.tokens.has(m[1]);
  }

  private answer(method: string, path: string, authorization: string | null, body: BodyInit | null | undefined): Response {
    if (method === "GET" && path === "/health") return json(200, healthExample);
    if (method === "POST" && path === "/auth/login") {
      const sent = JSON.parse(typeof body === "string" ? body : "{}") as { name?: string; password?: string };
      if (sent.password !== SIM_PASSWORD) return json(401, { error: "bad_login", detail: "the name or the password is wrong" });
      this.issued += 1;
      const token = `sim-token-${this.issued}`;
      this.tokens.add(token);
      return json(200, { token, name: sent.name ?? "", role: "admin", expires_s: 3600, app: "studio" });
    }
    if (!this.signedIn(authorization)) return json(401, { error: "unauthorized", detail: "log in first" });
    if (method === "GET" && path === "/session") return json(200, sessionExample);
    if (method === "GET" && path === "/fleet") return json(200, fleetExample);
    if (method === "GET" && path === "/jobs") return json(200, jobsExample);
    return json(404, { error: "not_found", detail: `${method} ${path}` });
  }
}
