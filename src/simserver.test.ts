import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Api, ApiError, DEFAULT_TIMEOUTS } from "./api";
import { errorText } from "./i18n";
import { skipWhileBusy } from "./polling";
import { SIM_PASSWORD, SimRng, SimServer } from "./simserver";

/** What a promise throws, or null when it does not. */
const thrown = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: unknown) => e,
  );

describe("the simulated server", () => {
  it("answers like the examples and the client sends the token only after the login", async () => {
    const server = new SimServer(1);
    const api = new Api(null, server.fetcher);
    expect((await api.health()).name).toBe("eh3d-server");
    const login = await api.login("juan", SIM_PASSWORD);
    expect(api.token).toBe(login.token);
    expect((await api.session()).name).toBe("juan");
    expect(await api.fleet()).toBeTypeOf("object");
    expect(await api.jobs()).toHaveLength(1);
    expect(server.requests.map((r) => `${r.method} ${r.path}`)).toEqual(["GET /health", "POST /auth/login", "GET /session", "GET /fleet", "GET /jobs"]);
    expect(server.requests[0].authorization).toBeNull();
    expect(server.requests[2].authorization).toBe(`Bearer ${login.token}`);
  });

  it("refuses a wrong password and keeps no token", async () => {
    const api = new Api(null, new SimServer(1).fetcher);
    expect(await thrown(api.login("juan", "wrong"))).toMatchObject({ status: 401, code: "bad_login" });
    expect(api.token).toBeNull();
  });

  it("a server that is down ends every request as unreachable, and the same client works again when it is back", async () => {
    const server = new SimServer(1);
    const api = new Api(null, server.fetcher);
    await api.login("juan", SIM_PASSWORD);
    server.mode = "down";
    for (const call of [() => api.health(), () => api.session(), () => api.fleet(), () => api.jobs()]) {
      const e = await thrown(call());
      expect(e).toBeInstanceOf(ApiError);
      expect(e).toMatchObject({ status: 0, code: "unreachable" });
      expect(errorText("en", e).length).toBeGreaterThan(0);
    }
    expect(server.requests).toHaveLength(1);
    server.mode = "up";
    expect((await api.session()).name).toBe("juan");
  });

  it("a refusal of the server (503) keeps its code, and a page that is not JSON becomes the error of its status", async () => {
    const server = new SimServer(1);
    const api = new Api(null, server.fetcher);
    server.mode = "unavailable";
    expect(await thrown(api.health())).toMatchObject({ status: 503, code: "unavailable" });
    server.mode = "html";
    expect(await thrown(api.health())).toMatchObject({ status: 500, code: "http_500" });
    server.mode = "up";
    expect((await api.health()).name).toBe("eh3d-server");
  });

  it("a session that expired is refused with 401 and a new login brings the client back", async () => {
    const server = new SimServer(1);
    const api = new Api(null, server.fetcher);
    const first = await api.login("juan", SIM_PASSWORD);
    server.expireSessions();
    expect(await thrown(api.session())).toMatchObject({ status: 401, code: "unauthorized" });
    const second = await api.login("juan", SIM_PASSWORD);
    expect(second.token).not.toBe(first.token);
    expect((await api.session()).name).toBe("juan");
    const old = new Api(first.token, server.fetcher);
    expect(await thrown(old.session())).toMatchObject({ status: 401 });
  });

  it("a link that fails by chance fails the same requests for the same seed and the client sees only unreachable", async () => {
    const run = async (seed: number) => {
      const server = new SimServer(seed);
      server.mode = "flaky";
      const api = new Api(null, server.fetcher);
      const outcomes: boolean[] = [];
      for (let i = 0; i < 400; i++) {
        const e = await thrown(api.health());
        if (e !== null) expect(e).toMatchObject({ status: 0, code: "unreachable" });
        outcomes.push(e === null);
      }
      server.mode = "up";
      expect((await api.health()).name).toBe("eh3d-server");
      return outcomes;
    };
    const a = await run(5);
    expect(await run(5)).toEqual(a);
    expect(await run(6)).not.toEqual(a);
    const failures = a.filter((ok) => !ok).length;
    expect(failures).toBeGreaterThan(40);
    expect(failures).toBeLessThan(200);
  });

  it("the generator does not stall on a zero seed", () => {
    const rng = new SimRng(0);
    expect(new Set([rng.below(1000), rng.below(1000), rng.below(1000), rng.below(1000)]).size).toBeGreaterThan(1);
  });
});

describe("a server that says nothing", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ends as a timeout, and a page that asks again every few seconds does not pile up requests while it waits", async () => {
    const server = new SimServer(1);
    server.mode = "hang";
    const api = new Api(null, server.fetcher);
    const poll = skipWhileBusy(() => api.health());
    expect(poll()).toBe(true);
    for (let i = 0; i < 4; i++) {
      await vi.advanceTimersByTimeAsync(1000);
      expect(poll()).toBe(false);
    }
    expect(server.attempts).toBe(1);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.health);
    expect(poll()).toBe(true);
    expect(server.attempts).toBe(2);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.health + 1);
    server.mode = "up";
    expect(poll()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(server.requests).toHaveLength(1);
    expect(server.attempts).toBe(3);
  });

  it("a request that hangs is cancelled with the error timeout, and the same client answers once the server is back", async () => {
    const server = new SimServer(1);
    server.mode = "hang";
    const api = new Api(null, server.fetcher);
    const caught = thrown(api.health());
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.health + 1);
    expect(await caught).toMatchObject({ status: 0, code: "timeout" });
    server.mode = "up";
    expect((await api.health()).name).toBe("eh3d-server");
  });
});
