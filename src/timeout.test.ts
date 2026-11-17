import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Api, ApiError, DEFAULT_TIMEOUTS, STOP_RESEND_WINDOW_MS } from "./api";
import { CORE_LANGS, errorText, LANGS, text } from "./i18n";
import { skipWhileBusy } from "./polling";

/** A fetch that never answers, and does not look at the signal either. */
const silent = () => new Promise<Response>(() => {});

describe("the time a request may take", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ends a request that gets no answer as the error timeout, after the time of the health check, and cancels it", async () => {
    let signal: AbortSignal | undefined;
    const api = new Api("t", (_url, init) => {
      signal = init?.signal ?? undefined;
      return silent();
    });
    const caught = api.health().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.health - 1);
    expect(signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    const e = await caught;
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 0, code: "timeout" });
    expect(signal?.aborted).toBe(true);
  });

  it("gives an ordinary request longer than the health check and a plan longer still", async () => {
    const api = new Api("t", silent);
    const fleet = api.fleet().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.health + 1);
    let settled = false;
    void fleet.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.normal);
    expect(await fleet).toMatchObject({ code: "timeout" });

    const preview = api.previewJob("m1", {}).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.normal + 1);
    settled = false;
    void preview.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.long);
    expect(await preview).toMatchObject({ code: "timeout" });
  });

  it("takes the times from the caller and leaves an answer that comes in time alone", async () => {
    const api = new Api("t", async () => new Response(JSON.stringify({ status: "ok" }), { status: 200 }), { health: 10 });
    await expect(api.health()).resolves.toMatchObject({ status: "ok" });
    await vi.advanceTimersByTimeAsync(1000);
    const slow = new Api("t", silent, { health: 10 });
    const caught = slow.health().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(11);
    expect(await caught).toMatchObject({ code: "timeout" });
  });

  it("says the timeout in all the languages, without the detail of the time", () => {
    const e = new ApiError(0, "timeout", "5000 ms");
    for (const lang of LANGS) {
      expect(errorText(lang, e)).toBe(text(lang, "err_timeout"));
      expect(errorText(lang, e)).not.toContain("5000");
    }
    // the eight core languages say it each in its own words
    expect(new Set(CORE_LANGS.map((l) => text(l, "err_timeout"))).size).toBe(CORE_LANGS.length);
  });
});

describe("a page that asks again every few seconds", () => {
  it("does not start a request while the last one is in flight", async () => {
    let finish: () => void = () => {};
    let started = 0;
    const ask = skipWhileBusy(() => {
      started++;
      return new Promise<void>((resolve) => (finish = resolve));
    });
    expect(ask()).toBe(true);
    expect(ask()).toBe(false);
    expect(ask()).toBe(false);
    expect(started).toBe(1);
    finish();
    await Promise.resolve();
    await Promise.resolve();
    expect(ask()).toBe(true);
    expect(started).toBe(2);
  });

  it("goes on after a request that failed", async () => {
    let started = 0;
    const ask = skipWhileBusy(() => {
      started++;
      return Promise.reject(new Error("down"));
    });
    expect(ask()).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(ask()).toBe(true);
    expect(started).toBe(2);
  });
});

describe("the stop button", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("waits only the time of the stop, not that of an ordinary request, and tries once more", async () => {
    let calls = 0;
    const api = new Api("t", (_url, _init) => {
      calls += 1;
      return calls === 1 ? silent() : Promise.resolve(new Response(JSON.stringify({ ok: true, stopped: true, job: "j1" }), { status: 200 }));
    });
    const done = api.stopMachine("m1");
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.stop + 1);
    expect(await done).toEqual({ ok: true, stopped: true, job: "j1" });
    expect(calls).toBe(2);
    expect(DEFAULT_TIMEOUTS.stop).toBeLessThan(DEFAULT_TIMEOUTS.normal);
  });

  it("gives up after the second attempt with the error of the transport", async () => {
    const api = new Api("t", silent);
    const done = api.stopMachine("m1").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.stop + 1);
    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.stop + 1);
    expect(await done).toMatchObject({ status: 0, code: "timeout" });
  });

  it("does not repeat a stop the server answered, even with an error", async () => {
    let calls = 0;
    const api = new Api("t", async () => {
      calls += 1;
      return new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
    });
    await expect(api.stopMachine("m1")).rejects.toMatchObject({ status: 404 });
    expect(calls).toBe(1);
  });
});

describe("a stop refused by an ended login", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const login = new Response(JSON.stringify({ token: "new", name: "n", role: "operator", expires_s: 60 }), { status: 200 });

  function server(log: string[]) {
    let ended = true;
    return new Api("old", async (url, init) => {
      const path = String(url);
      log.push(`${init?.method} ${path}`);
      if (path.endsWith("/auth/login")) { ended = false; return login.clone(); }
      return ended ? new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }) : new Response(JSON.stringify({ ok: true, stopped: true, job: null }), { status: 200 });
    });
  }

  it("is sent again once after the next login", async () => {
    const log: string[] = [];
    const api = server(log);
    await expect(api.stopMachine("m1")).rejects.toMatchObject({ status: 401 });
    await api.login("n", "p");
    expect(log.filter((l) => l.endsWith("/machines/m1/stop"))).toHaveLength(2);
    await api.login("n", "p");
    expect(log.filter((l) => l.endsWith("/machines/m1/stop"))).toHaveLength(2);
  });

  it("is not sent after the window, so an old order never stops a later job", async () => {
    const log: string[] = [];
    const api = server(log);
    await expect(api.stopMachine("m1")).rejects.toMatchObject({ status: 401 });
    await vi.advanceTimersByTimeAsync(STOP_RESEND_WINDOW_MS + 1);
    await api.login("n", "p");
    expect(log.filter((l) => l.endsWith("/machines/m1/stop"))).toHaveLength(1);
  });

  it("is not kept when the server refused it for another reason", async () => {
    const log: string[] = [];
    const api = new Api("t", async (url, init) => {
      log.push(`${init?.method} ${String(url)}`);
      return String(url).endsWith("/auth/login") ? login.clone() : new Response(JSON.stringify({ error: "not_found" }), { status: 404 });
    });
    await expect(api.stopMachine("m1")).rejects.toMatchObject({ status: 404 });
    await api.login("n", "p");
    expect(log.filter((l) => l.endsWith("/stop"))).toHaveLength(1);
  });
});
