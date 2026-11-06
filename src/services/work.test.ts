import { describe, expect, it } from "vitest";
import { ServiceHttp } from "./http";
import { fakeServer } from "./testkit";
import {
  WorkClient,
  applyJob,
  canHold,
  countByState,
  filterQueue,
  jobActions,
  markedRead,
  notificationFromEvent,
  orderQueue,
  parseRequest,
  parseSettings,
  percentOf,
  requestKinds,
  requestTemplate,
  unreadCount,
  validMachineId,
  withNotification,
} from "./work";
import type { WorkJobSummary, WorkNotification } from "./types";

const job = (id: string, state: WorkJobSummary["state"], extra: Partial<WorkJobSummary> = {}): WorkJobSummary => ({ id, machine: "demo-1", plugin: "demo", state, ...extra });

describe("the client of the plugins and the queue", () => {
  it("lists the plugins and the machines, and asks for the jobs with the filters", async () => {
    const s = fakeServer({
      "GET /plugins": () => ({ plugins: [{ kind: "demo", title: "Demo", capabilities: {}, manages_machines: true }] }),
      "GET /work/machines": () => ({ machines: [{ id: "demo-1", name: "Demo", plugin: "demo", state: "idle" }] }),
      "GET /work/jobs": () => ({ total: 0, offset: 0, limit: 100, items: [] }),
    });
    const w = new WorkClient(new ServiceHttp(() => "t", s.fetcher));
    expect((await w.plugins())[0].kind).toBe("demo");
    expect((await w.machines())[0].id).toBe("demo-1");
    await w.jobs({ machine: "demo-1", state: "running", mine: true });
    expect(s.calls[2].query.get("machine")).toBe("demo-1");
    expect(s.calls[2].query.get("state")).toBe("running");
    expect(s.calls[2].query.get("mine")).toBe("true");
    expect(s.calls[2].query.get("limit")).toBe("100");
  });

  it("prepares, starts, holds, resumes, cancels and removes a job, each on its own route", async () => {
    const answer = () => ({ id: "w-1", machine: "demo-1", plugin: "demo", state: "queued" });
    const s = fakeServer({
      "POST /work/jobs": answer,
      "POST /work/jobs/w-1/start": answer,
      "POST /work/jobs/w-1/pause": answer,
      "POST /work/jobs/w-1/resume": answer,
      "POST /work/jobs/w-1/cancel": answer,
      "DELETE /work/jobs/w-1": () => ({ ok: true }),
      "POST /notifications/read": () => ({ marked: 2 }),
      "GET /notifications": () => ({ notifications: [] }),
    });
    const w = new WorkClient(new ServiceHttp(() => "t", s.fetcher));
    await w.create({ machine: "demo-1", request: { kind: "demo", steps: 3 }, name: "x" });
    await w.start("w-1");
    await w.pause("w-1");
    await w.resume("w-1");
    await w.cancel("w-1");
    await w.remove("w-1");
    await w.markRead({ all: true });
    await w.notifications(true);
    expect(s.calls[0].body).toEqual({ machine: "demo-1", request: { kind: "demo", steps: 3 }, name: "x" });
    expect(s.calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "POST /work/jobs",
      "POST /work/jobs/w-1/start",
      "POST /work/jobs/w-1/pause",
      "POST /work/jobs/w-1/resume",
      "POST /work/jobs/w-1/cancel",
      "DELETE /work/jobs/w-1",
      "POST /notifications/read",
      "GET /notifications",
    ]);
    expect(s.calls[6].body).toEqual({ all: true });
    expect(s.calls[7].query.get("unread")).toBe("true");
  });
});

describe("the buttons of a job", () => {
  const viewer = { role: "viewer" } as const;
  const operator = { role: "operator" } as const;
  const admin = { role: "admin" } as const;

  it("give a viewer none, an operator the actions of the state, and an administrator the same", () => {
    for (const s of ["queued", "running", "paused", "done"] as const) expect(jobActions(job("a", s), viewer)).toEqual([]);
    expect(jobActions(job("a", "queued"), operator)).toEqual(["start", "cancel"]);
    expect(jobActions(job("a", "running"), operator)).toEqual(["pause", "cancel"]);
    expect(jobActions(job("a", "paused"), operator)).toEqual(["resume", "cancel"]);
    for (const s of ["done", "failed", "cancelled"] as const) expect(jobActions(job("a", s), admin)).toEqual(["remove"]);
  });

  it("follow the scopes of a token: a token that cannot cancel has no stop and no delete", () => {
    const token = { role: "operator", scopes: ["machines:view", "jobs:prepare", "jobs:start"] } as const;
    expect(jobActions(job("a", "queued"), token)).toEqual(["start"]);
    expect(jobActions(job("a", "done"), token)).toEqual([]);
    const readOnly = { role: "operator", scopes: ["machines:view"] } as const;
    expect(jobActions(job("a", "queued"), readOnly)).toEqual([]);
  });

  it("do not offer to hold a job on a machine that cannot be held", () => {
    expect(jobActions(job("a", "running"), operator, { pause: "none" })).toEqual(["cancel"]);
    expect(jobActions(job("a", "running"), operator, { pause: "all" })).toEqual(["pause", "cancel"]);
    expect(canHold(undefined)).toBe(true);
    expect(canHold({ pause: "gcode" })).toBe(true);
    expect(canHold({ pause: false })).toBe(false);
  });

  it("give nothing to a person who is not signed in", () => {
    expect(jobActions(job("a", "queued"), null)).toEqual([]);
  });
});

describe("the queue", () => {
  const jobs = [
    job("done-1", "done", { created: 10, name: "Old board", owner: "ana" }),
    job("queued-2", "queued", { position: 2, created: 30, owner: "bob" }),
    job("run", "running", { created: 20, owner: "ana", percent: 40 }),
    job("queued-1", "queued", { position: 1, created: 40, owner: "ana" }),
    job("held", "paused", { created: 5 }),
    job("fail", "failed", { created: 50, machine: "other" }),
  ];

  it("lists what runs, what is held, what waits in its place, and then the finished, the newest first", () => {
    expect(orderQueue(jobs).map((j) => j.id)).toEqual(["run", "held", "queued-1", "queued-2", "fail", "done-1"]);
  });

  it("filters by machine, state (also all that is active), owner and words", () => {
    const f = { machine: "", state: "", query: "", mine: false, me: "ana" };
    expect(filterQueue(jobs, f)).toHaveLength(6);
    expect(filterQueue(jobs, { ...f, machine: "other" }).map((j) => j.id)).toEqual(["fail"]);
    expect(filterQueue(jobs, { ...f, state: "active" }).map((j) => j.id)).toEqual(["queued-2", "run", "queued-1", "held"]);
    expect(filterQueue(jobs, { ...f, state: "done" }).map((j) => j.id)).toEqual(["done-1"]);
    expect(filterQueue(jobs, { ...f, mine: true })).toHaveLength(3);
    expect(filterQueue(jobs, { ...f, query: " OLD " }).map((j) => j.id)).toEqual(["done-1"]);
  });

  it("works out the percentage from the state, the percent or the work done", () => {
    expect(percentOf({ state: "done" })).toBe(100);
    expect(percentOf({ state: "running", percent: 140 })).toBe(100);
    expect(percentOf({ state: "running", percent: 40 })).toBe(40);
    expect(percentOf({ state: "running", done: 3, total: 12 })).toBe(25);
    expect(percentOf({ state: "queued" })).toBe(0);
  });

  it("counts the jobs by state and puts an answer of the server into the list", () => {
    const c = countByState(jobs);
    expect(c).toMatchObject({ queued: 2, running: 1, paused: 1, done: 1, failed: 1, cancelled: 0 });
    const next = applyJob(jobs, job("run", "done", { percent: 100 }));
    expect(next.find((j) => j.id === "run")?.state).toBe("done");
    expect(next).toHaveLength(6);
    expect(applyJob(jobs, job("new", "queued"))[0].id).toBe("new");
  });
});

describe("the request typed by hand", () => {
  it("has to be a JSON object", () => {
    expect(parseRequest('{"kind":"demo","steps":3}')).toEqual({ ok: true, value: { kind: "demo", steps: 3 } });
    expect(parseRequest("")).toMatchObject({ ok: false, reason: "empty" });
    expect(parseRequest("{kind:")).toMatchObject({ ok: false, reason: "syntax" });
    expect(parseRequest("[1]")).toMatchObject({ ok: false, reason: "not_object" });
    expect(parseRequest("3")).toMatchObject({ ok: false, reason: "not_object" });
  });

  it("starts from a template for the kinds the plugin takes", () => {
    expect(JSON.parse(requestTemplate(["demo"]))).toEqual({ kind: "demo", steps: 10 });
    expect(JSON.parse(requestTemplate(["drill", "route", "gcode"])).kind).toBe("gcode");
    expect(JSON.parse(requestTemplate(["laser"]))).toEqual({ kind: "laser" });
    expect(requestTemplate([])).toBe("{}");
    expect(requestKinds({ requests: ["drill", 3, "route"] })).toEqual(["drill", "route"]);
    expect(requestKinds(undefined)).toEqual([]);
  });

  it("takes the settings of a machine as nothing or an object, and the id as the server writes it", () => {
    expect(parseSettings("")).toEqual({});
    expect(parseSettings('{"step_ms": 5}')).toEqual({ step_ms: 5 });
    expect(parseSettings("[1]")).toBeNull();
    expect(validMachineId("demo-1")).toBe(true);
    expect(validMachineId("Demo")).toBe(false);
    expect(validMachineId("-a")).toBe(false);
    expect(validMachineId("")).toBe(false);
  });
});

describe("the notifications", () => {
  const n = (id: number, read = false): WorkNotification => ({ id, kind: "job.done", title: "A job finished", read });

  it("count the unread, mark some or all as read and add the one that came on the stream once", () => {
    const list = [n(1), n(2, true), n(3)];
    expect(unreadCount(list)).toBe(2);
    expect(markedRead(list, [3]).map((x) => x.read)).toEqual([false, true, true]);
    expect(unreadCount(markedRead(list, "all"))).toBe(0);
    expect(withNotification(list, n(4)).map((x) => x.id)).toEqual([4, 1, 2, 3]);
    expect(withNotification(list, n(2))).toHaveLength(3);
  });

  it("read the data of the event of a notification", () => {
    expect(notificationFromEvent({ id: 7, kind: "job.failed", title: "A job failed", data: { machine: "demo-1" } })).toMatchObject({ id: 7, kind: "job.failed", read: false });
    expect(notificationFromEvent({ kind: "job.failed" })).toBeNull();
    expect(notificationFromEvent(null)).toBeNull();
    expect(notificationFromEvent({ id: 1, kind: "job.done" })?.title).toBe("job.done");
  });
});
