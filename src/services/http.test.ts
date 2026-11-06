import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api";
import { DEFAULT_LIMITS, ServiceHttp, quoteTag, readLimited, unquoteTag, withQuery } from "./http";

const ok = (body: unknown = {}, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init });
const no = () => Promise.resolve();

describe("the address and the tag", () => {
  it("builds the query without the values that are empty", () => {
    expect(withQuery("/x", { a: 1, b: "", c: undefined, d: null, e: "hi there" })).toBe("/x?a=1&e=hi+there");
    expect(withQuery("/x?f=1", { a: 2 })).toBe("/x?f=1&a=2");
    expect(withQuery("/x", undefined)).toBe("/x");
    expect(withQuery("/x", {})).toBe("/x");
  });

  it("puts the tag between quotes and takes it out again", () => {
    expect(quoteTag("abc")).toBe('"abc"');
    expect(quoteTag('"abc"')).toBe('"abc"');
    expect(quoteTag('W/"abc"')).toBe('"abc"');
    expect(unquoteTag('"abc"')).toBe("abc");
    expect(unquoteTag(null)).toBeNull();
  });
});

describe("the requests", () => {
  it("carry the token as it is at each request, the query and a JSON body", async () => {
    let token: string | null = "one";
    const seen: { url: string; init?: RequestInit }[] = [];
    const http = new ServiceHttp(
      () => token,
      async (url, init) => {
        seen.push({ url, init });
        return ok({ fine: true });
      },
    );
    await http.json("POST", "/x", { query: { q: "a b" }, json: { n: 1 } });
    token = null;
    await http.json("GET", "/y");
    expect(seen[0].url).toBe("/api/v1/x?q=a+b");
    const h0 = seen[0].init?.headers as Record<string, string>;
    expect(h0.authorization).toBe("Bearer one");
    expect(h0["content-type"]).toBe("application/json");
    expect(seen[0].init?.body).toBe('{"n":1}');
    expect((seen[1].init?.headers as Record<string, string>).authorization).toBeUndefined();
  });

  it("send raw bytes with their content type and read the tag of the answer", async () => {
    const http = new ServiceHttp(
      () => "t",
      async (_url, init) => {
        expect((init?.headers as Record<string, string>)["content-type"]).toBe("application/octet-stream");
        return ok({ version: 2 }, { headers: { etag: '"deadbeef"' } });
      },
    );
    const r = await http.jsonWithTag<{ version: number }>("PUT", "/f", { bytes: new Uint8Array([1, 2, 3]) });
    expect(r.data.version).toBe(2);
    expect(r.etag).toBe("deadbeef");
  });

  it("turn a refusal of the server into an ApiError with its status, code and detail", async () => {
    const http = new ServiceHttp(() => "t", async () => new Response(JSON.stringify({ error: "precondition_failed", detail: "tag" }), { status: 412 }));
    const e = await http.json("PUT", "/f").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(ApiError);
    expect(e).toMatchObject({ status: 412, code: "precondition_failed", detail: "tag" });
    const odd = new ServiceHttp(() => "t", async () => new Response("<html>", { status: 502 }), { retries: 0 });
    expect(await odd.json("GET", "/f").catch((x: unknown) => x)).toMatchObject({ status: 502, code: "http_502" });
  });

  it("read an empty body as null", async () => {
    const http = new ServiceHttp(() => "t", async () => new Response("", { status: 200 }));
    expect(await http.json("DELETE", "/f")).toBeNull();
  });
});

describe("the new tries of a read", () => {
  it("try a GET again when the network fails or a gateway is not ready, a few times and with a longer wait each", async () => {
    const waits: number[] = [];
    let n = 0;
    const http = new ServiceHttp(
      () => "t",
      async () => {
        n += 1;
        if (n === 1) throw new TypeError("down");
        if (n === 2) return new Response("", { status: 503 });
        return ok({ fine: n });
      },
      { retries: 2, retryDelayMs: 100 },
      async (ms) => void waits.push(ms),
    );
    expect(await http.json("GET", "/x")).toEqual({ fine: 3 });
    expect(waits).toEqual([100, 200]);
  });

  it("give up after the tries and tell the last error", async () => {
    let n = 0;
    const http = new ServiceHttp(
      () => "t",
      async () => {
        n += 1;
        throw new TypeError("down");
      },
      { retries: 2 },
      no,
    );
    expect(await http.json("GET", "/x").catch((e: unknown) => e)).toMatchObject({ code: "unreachable" });
    expect(n).toBe(3);
  });

  it("never try a write again, and do not try again a refusal", async () => {
    let writes = 0;
    const w = new ServiceHttp(() => "t", async () => (writes++, new Response("", { status: 503 })), { retries: 3 }, no);
    await w.json("PUT", "/x").catch(() => undefined);
    expect(writes).toBe(1);
    let reads = 0;
    const r = new ServiceHttp(() => "t", async () => (reads++, new Response(JSON.stringify({ error: "unknown_file", detail: "" }), { status: 404 })), { retries: 3 }, no);
    await r.json("GET", "/x").catch(() => undefined);
    expect(reads).toBe(1);
  });
});

describe("the time limit", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("ends a request that gets no answer as a timeout and cancels it; a transfer has more time", async () => {
    let signal: AbortSignal | undefined;
    const http = new ServiceHttp(
      () => "t",
      (_url, init) => {
        signal = init?.signal ?? undefined;
        return new Promise<Response>(() => {});
      },
      { normal: 1000, transfer: 5000, retries: 0 },
      no,
    );
    const quick = http.json("GET", "/x").catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1001);
    expect(await quick).toMatchObject({ status: 0, code: "timeout" });
    expect(signal?.aborted).toBe(true);
    const slow = http.json("GET", "/x", { transfer: true }).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(1500);
    let settled = false;
    void slow.then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(4000);
    expect(await slow).toMatchObject({ code: "timeout" });
  });
});

describe("the size of a file", () => {
  it("refuses a download whose header says it is too big, and one that turns out to be when read", async () => {
    const big = new Response(new Uint8Array(10), { headers: { "content-length": "999999" } });
    expect(await readLimited(big, 100).catch((e: unknown) => e)).toMatchObject({ code: "download_too_big" });
    const stream = new Response(new Uint8Array(500));
    expect(await readLimited(stream, 100).catch((e: unknown) => e)).toMatchObject({ code: "download_too_big" });
    const fine = await readLimited(new Response(new Uint8Array([1, 2, 3])), 100);
    expect(Array.from(fine)).toEqual([1, 2, 3]);
  });

  it("limits a download for one request and refuses an upload before it is sent", async () => {
    let sent = 0;
    const http = new ServiceHttp(
      () => "t",
      async () => {
        sent += 1;
        return new Response(new Uint8Array(50));
      },
      { maxUpload: 10 },
    );
    expect(await http.send("GET", "/f", { maxDownload: 20, retries: 0 }).catch((e: unknown) => e)).toMatchObject({ code: "download_too_big" });
    expect(await http.send("PUT", "/f", { bytes: new Uint8Array(11) }).catch((e: unknown) => e)).toMatchObject({ code: "upload_too_big" });
    expect(sent).toBe(1);
    expect(DEFAULT_LIMITS.maxDownload).toBeGreaterThan(1024 * 1024);
  });
});
