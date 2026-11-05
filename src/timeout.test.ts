import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Api, ApiError, DEFAULT_TIMEOUTS } from "./api";
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
