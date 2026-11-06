import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_FEED, EventFeed, FEED_KEEP, affects, backoffMs, eventLine, familyOf, feedReducer, matchesFeed, streamUrl } from "./events";
import type { FeedEvent, FeedStatus } from "./events";
import { FakeSource } from "./testkit";

/** A feed whose clock the test moves: the waits are kept, and `fire` runs the oldest one. */
function harness(maxAttempts?: number) {
  const waits: { fn: () => void; ms: number }[] = [];
  let tickets = 0;
  const feed = new EventFeed({
    open: (url) => new FakeSource(url),
    ticket: async () => `t${++tickets}`,
    later: (fn, ms) => {
      const w = { fn, ms };
      waits.push(w);
      return () => waits.splice(waits.indexOf(w), 1);
    },
    maxAttempts,
  });
  const statuses: FeedStatus[] = [];
  const events: FeedEvent[] = [];
  const resyncs: number[] = [];
  feed.subscribe({ onStatus: (s) => statuses.push(s), onEvent: (e) => events.push(e), onResync: () => resyncs.push(1) });
  const settle = async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  };
  const fire = async () => {
    waits.shift()!.fn();
    await settle();
  };
  return { feed, waits, statuses, events, resyncs, settle, fire };
}

beforeEach(() => FakeSource.reset());

describe("the address of the stream", () => {
  it("carries the ticket, the number of the last event and the filters", () => {
    expect(streamUrl("tk", null)).toBe("/api/v1/events/stream?ticket=tk");
    const u = new URL(streamUrl("tk", 17, { machine: "demo-1", kinds: ["job", "project.file"], app: "studio" }), "http://x");
    expect(u.searchParams.get("last_event_id")).toBe("17");
    expect(u.searchParams.get("machine")).toBe("demo-1");
    expect(u.searchParams.get("kinds")).toBe("job,project.file");
    expect(u.searchParams.get("app")).toBe("studio");
  });

  it("waits longer after each failure, up to half a minute", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 20].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
  });
});

describe("the feed", () => {
  it("asks for a ticket, opens the stream and goes live on the hello", async () => {
    const h = harness();
    h.feed.start();
    await h.settle();
    expect(FakeSource.all).toHaveLength(1);
    expect(FakeSource.all[0].url).toContain("ticket=t1");
    expect(h.statuses.at(-1)).toBe("connecting");
    FakeSource.all[0].emit("hello", { last_id: 5, resumed: false, resync: false, clients: 1 });
    expect(h.statuses.at(-1)).toBe("live");
  });

  it("hands on the events with their numbers, by the name of the kind", async () => {
    const h = harness();
    h.feed.start();
    await h.settle();
    const s = FakeSource.all[0];
    s.emit("hello", { last_id: 0, resumed: false, resync: false, clients: 1 });
    s.emit("job.state", { id: 1, kind: "job.state", machine: "demo-1", job: "w-1", data: { state: "running" } }, 1);
    s.emit("project.file", { id: 2, kind: "project.file", project: "p-1", app: "studio" }, 2);
    s.emit("unheard.kind", { id: 3, kind: "unheard.kind" }, 3);
    expect(h.events.map((e) => [e.id, e.kind])).toEqual([
      [1, "job.state"],
      [2, "project.file"],
    ]);
    expect(h.feed.state.lastId).toBe(2);
  });

  it("asks for a new ticket and carries the last number when the connection ends, after a wait", async () => {
    const h = harness();
    h.feed.start();
    await h.settle();
    const first = FakeSource.all[0];
    first.emit("hello", { last_id: 0, resumed: false, resync: false, clients: 1 });
    first.emit("job.progress", { id: 9, kind: "job.progress" }, 9);
    first.fail();
    expect(first.closed).toBe(true);
    expect(h.statuses.at(-1)).toBe("reconnecting");
    expect(h.waits.map((w) => w.ms)).toEqual([1000]);
    await h.fire();
    expect(FakeSource.all).toHaveLength(2);
    const url = new URL(FakeSource.all[1].url, "http://x");
    expect(url.searchParams.get("ticket")).toBe("t2");
    expect(url.searchParams.get("last_event_id")).toBe("9");
  });

  it("waits twice as long after each failure in a row and starts over when the hello comes", async () => {
    const h = harness();
    h.feed.start();
    await h.settle();
    FakeSource.all[0].fail();
    await h.fire();
    FakeSource.all[1].fail();
    expect(h.waits.map((w) => w.ms)).toEqual([2000]);
    await h.fire();
    FakeSource.all[2].emit("hello", { last_id: 0, resumed: true, resync: false, clients: 2 });
    expect(h.feed.state.attempt).toBe(0);
    FakeSource.all[2].fail();
    expect(h.waits.map((w) => w.ms)).toEqual([1000]);
  });

  it("gives up after the attempts it may make and starts again when the person asks", async () => {
    const h = harness(2);
    h.feed.start();
    await h.settle();
    FakeSource.all[0].fail();
    await h.fire();
    FakeSource.all[1].fail();
    await h.fire();
    FakeSource.all[2].fail();
    expect(h.statuses.at(-1)).toBe("failed");
    expect(h.waits).toHaveLength(0);
    h.feed.start();
    await h.settle();
    expect(FakeSource.all).toHaveLength(4);
    expect(h.statuses.at(-1)).toBe("connecting");
  });

  it("tells the page to ask for the state again when the server says it could not keep what was missed", async () => {
    const h = harness();
    h.feed.start();
    await h.settle();
    FakeSource.all[0].emit("hello", { last_id: 50, resumed: true, resync: true, clients: 1 });
    expect(h.resyncs).toHaveLength(1);
    FakeSource.all[0].emit("resync", { id: 60, kind: "resync", data: { missed: 5 } }, 60);
    expect(h.resyncs).toHaveLength(2);
  });

  it("fails and waits when the ticket cannot be had, or the browser has no EventSource", async () => {
    const waits: number[] = [];
    const feed = new EventFeed({
      open: () => {
        throw new Error("no EventSource");
      },
      ticket: async () => "t",
      later: (_fn, ms) => {
        waits.push(ms);
        return () => undefined;
      },
    });
    feed.start();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(waits).toEqual([1000]);
    expect(feed.state.status).toBe("reconnecting");
    const nope = new EventFeed({
      open: (url) => new FakeSource(url),
      ticket: async () => {
        throw new Error("401");
      },
      later: (_fn, ms) => {
        waits.push(ms);
        return () => undefined;
      },
    });
    nope.start();
    for (let i = 0; i < 5; i++) await Promise.resolve();
    expect(waits).toEqual([1000, 1000]);
    expect(FakeSource.all).toHaveLength(0);
  });

  it("stops: closes the stream, drops the wait and ignores what the old stream still says", async () => {
    const h = harness();
    h.feed.start();
    await h.settle();
    const s = FakeSource.all[0];
    s.fail();
    expect(h.waits).toHaveLength(1);
    h.feed.stop();
    expect(h.waits).toHaveLength(0);
    expect(h.statuses.at(-1)).toBe("stopped");
    s.emit("job.state", { id: 1, kind: "job.state" }, 1);
    expect(h.events).toHaveLength(0);
  });
});

describe("the events on the page", () => {
  const ev = (id: number, kind: string, extra: Partial<FeedEvent> = {}): FeedEvent => ({ id, kind, ...extra });

  it("keeps the newest first, never twice the same, never more than the limit", () => {
    let s = feedReducer(EMPTY_FEED, { type: "event", event: ev(1, "job.state") });
    s = feedReducer(s, { type: "event", event: ev(2, "job.progress") });
    s = feedReducer(s, { type: "event", event: ev(2, "job.progress") });
    expect(s.events.map((e) => e.id)).toEqual([2, 1]);
    expect(s.total).toBe(2);
    for (let i = 3; i < FEED_KEEP + 20; i++) s = feedReducer(s, { type: "event", event: ev(i, "job.state") });
    expect(s.events).toHaveLength(FEED_KEEP);
    expect(s.events[0].id).toBe(FEED_KEEP + 19);
    const cleared = feedReducer(feedReducer(s, { type: "resync" }), { type: "clear" });
    expect(cleared.events).toEqual([]);
    expect(cleared.resyncs).toBe(1);
  });

  it("filters by machine, job and family of the kind", () => {
    const e = ev(1, "job.state", { machine: "demo-1", job: "w-1" });
    expect(matchesFeed(e, { machine: "", job: "", family: "" })).toBe(true);
    expect(matchesFeed(e, { machine: "demo-1", job: "w-1", family: "job" })).toBe(true);
    expect(matchesFeed(e, { machine: "other", job: "", family: "" })).toBe(false);
    expect(matchesFeed(e, { machine: "", job: "w-2", family: "" })).toBe(false);
    expect(matchesFeed(e, { machine: "", job: "", family: "project" })).toBe(false);
    expect(familyOf("notification")).toBe("notification");
    expect(familyOf("project.file_removed")).toBe("project");
  });

  it("tells which lists an event makes worth asking for again", () => {
    expect(affects(ev(1, "project.locked"), "projects")).toBe(true);
    expect(affects(ev(1, "job.state"), "projects")).toBe(false);
    expect(affects(ev(1, "job.created"), "jobs")).toBe(true);
    expect(affects(ev(1, "resync"), "jobs")).toBe(true);
    expect(affects(ev(1, "machine.changed"), "machines")).toBe(true);
    expect(affects(ev(1, "catalog.changed"), "machines")).toBe(false);
  });

  it("writes an event as a line with what it is about and the state", () => {
    expect(eventLine(ev(1, "job.state", { machine: "demo-1", job: "w-9", data: { state: "done" } }))).toBe("job.state · demo-1 · w-9 · done");
    expect(eventLine(ev(2, "catalog.changed"))).toBe("catalog.changed");
  });
});
