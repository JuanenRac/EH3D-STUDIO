import { describe, expect, it } from "vitest";
import { SimRng } from "../simserver";
import { ServiceHttp } from "./http";
import { fakeServer } from "./testkit";
import { authState, jobActions, shortHash, WorkClient } from "./work";
import { can } from "./permissions";
import {
  EMPTY_NODE_FORM,
  NodeSocket,
  PNP_HEALTHS,
  PnpClient,
  TOKEN_MARK,
  applyNodeEvent,
  changeBody,
  countReady,
  formOf,
  formProblems,
  healthText,
  healthTone,
  isReadyHealth,
  newBody,
  nodeActions,
  nodeEvent,
  nodeFacts,
} from "./pnp";
import type { PnpNode, SocketLike } from "./pnp";
import { ROWS } from "../texts";

const node = (id: string, extra: Partial<PnpNode> = {}): PnpNode => ({
  id,
  kind: "feeder",
  name: `Node ${id}`,
  address: "192.168.0.60:80",
  token: TOKEN_MARK,
  machine: "pnp-1",
  enabled: true,
  health: "ok",
  ready: true,
  polls: { ok: 3, failed: 0 },
  last_error: "",
  status: null,
  evidence: "simulator",
  ...extra,
});

describe("the client of the nodes of the pick-and-place machines", () => {
  it("asks the routes of the server, with the body each one needs and never a token it was not given", async () => {
    const s = fakeServer({
      "GET /pnp/nodes": () => ({ nodes: [node("feeder-1")], summary: { registered: 1, ready: 1, not_ready: 0 }, limits: { max: 16, poll_s: 5, silence_s: 30, timeout_s: 3, kinds: ["feeder", "head"] } }),
      "POST /pnp/nodes": () => node("head-1", { kind: "head" }),
      "PUT /pnp/nodes/feeder-1": () => node("feeder-1"),
      "DELETE /pnp/nodes/feeder-1": () => ({ ok: true }),
      "POST /pnp/nodes/feeder-1/poll": () => node("feeder-1", { polls: { ok: 4, failed: 0 } }),
      "GET /pnp/nodes/feeder-1": () => node("feeder-1"),
    });
    const c = new PnpClient(new ServiceHttp(() => "t", s.fetcher));
    expect((await c.list()).nodes[0].id).toBe("feeder-1");
    await c.add({ kind: "head", name: "Head", address: "h.local:80" });
    await c.change("feeder-1", { name: "Left", token: TOKEN_MARK });
    await c.poll("feeder-1");
    await c.get("feeder-1");
    await c.remove("feeder-1");
    expect(s.calls.map((x) => `${x.method} ${x.path}`)).toEqual(["GET /pnp/nodes", "POST /pnp/nodes", "PUT /pnp/nodes/feeder-1", "POST /pnp/nodes/feeder-1/poll", "GET /pnp/nodes/feeder-1", "DELETE /pnp/nodes/feeder-1"]);
    expect(s.calls[1].body).toEqual({ kind: "head", name: "Head", address: "h.local:80" });
    expect(s.calls[2].body).toEqual({ name: "Left", token: TOKEN_MARK });
  });
});

describe("the health of a node", () => {
  it("is ready only when it is ok or warns, whatever else the server says", () => {
    for (const h of PNP_HEALTHS) expect(isReadyHealth(h), h).toBe(h === "ok" || h === "warn");
    expect(isReadyHealth("something-new")).toBe(false);
  });

  it("has a tone and a text in the eight languages for every health, and a word of its own for one it does not know", () => {
    for (const h of PNP_HEALTHS) {
      const key = healthText(h);
      expect(key, h).not.toBeNull();
      expect(ROWS, h).toHaveProperty(key as string);
      expect(healthTone(h), h).toMatch(/^(ok|wait|dim|bad)$/);
    }
    expect(healthText("something-new")).toBeNull();
    expect(healthTone("something-new")).toBe("bad");
    expect(healthTone("ok")).toBe("ok");
    expect(healthTone("warn")).toBe("wait");
  });

  it("counts the nodes that are ready", () => {
    expect(countReady([node("a"), node("b", { ready: false }), node("c", { ready: false })])).toEqual({ registered: 3, ready: 1, notReady: 2 });
    expect(countReady([])).toEqual({ registered: 0, ready: 0, notReady: 0 });
  });

  it("reads the numbers of a feeder and of a head from what the node said last, and nothing when it said nothing", () => {
    expect(nodeFacts({ kind: "feeder", status: null })).toBeNull();
    const f = nodeFacts({ kind: "feeder", status: { safe: false, online: 3, slots: 4, low: 1, empty: 1, faulted: 0 } });
    expect(f?.key).toBe("pnp_facts_feeder");
    expect(f?.vars).toEqual({ online: 3, slots: 4, low: 1, empty: 1, faulted: 0 });
    const h = nodeFacts({ kind: "head", status: { nozzle_count: 2, pump: true, faulted: 1 } });
    expect(h?.key).toBe("pnp_facts_head");
    expect(h?.vars).toEqual({ nozzles: 2, faulted: 1 });
    expect(h?.pump).toBe(true);
    expect(nodeFacts({ kind: "head", status: {} })?.pump).toBeNull();
  });
});

describe("who may do what with the nodes", () => {
  const allowedFor = (role: "viewer" | "operator" | "admin", scopes: string[] | null = null) => (a: "machines.manage" | "jobs.prepare") => can({ role, scopes }, a);

  it("lets a viewer read, an operator ask a node now, and only an administrator register, change and remove", () => {
    expect(nodeActions(allowedFor("viewer"), node("a"))).toEqual([]);
    expect(nodeActions(allowedFor("operator"), node("a"))).toEqual(["poll"]);
    expect(nodeActions(allowedFor("admin"), node("a"))).toEqual(["poll", "edit", "remove"]);
  });

  it("does not offer to ask a node that is switched off, and follows the scopes of a token", () => {
    expect(nodeActions(allowedFor("admin"), node("a", { enabled: false }))).toEqual(["edit", "remove"]);
    expect(nodeActions(allowedFor("admin", ["machines:view"]), node("a"))).toEqual([]);
    expect(nodeActions(allowedFor("operator", ["jobs:prepare"]), node("a"))).toEqual(["poll"]);
  });
});

describe("the form of a node", () => {
  const good = { ...EMPTY_NODE_FORM, name: "Feeders left", address: "192.168.0.60:80" };

  it("is right with a name and a host:port, and says what is wrong before anything is sent", () => {
    expect(formProblems(good, false)).toEqual([]);
    expect(formProblems({ ...good, name: "  " }, false)).toEqual(["name"]);
    expect(formProblems({ ...good, address: "192.168.0.60" }, false)).toEqual(["address"]);
    expect(formProblems({ ...good, address: "user@host:80" }, false)).toEqual(["address"]);
    expect(formProblems({ ...good, id: "Feeder 1" }, false)).toEqual(["id"]);
    expect(formProblems({ ...good, id: "Feeder 1" }, true)).toEqual([]);
    expect(formProblems({ ...good, token: "has space" }, false)).toEqual(["token"]);
    expect(formProblems({ ...good, token: "a".repeat(201) }, false)).toEqual(["token"]);
    expect(formProblems({ ...good, name: "x".repeat(65) }, false)).toEqual(["name"]);
  });

  it("builds the body of a new node with only what was typed", () => {
    expect(newBody(good)).toEqual({ kind: "feeder", name: "Feeders left", address: "192.168.0.60:80", enabled: true });
    expect(newBody({ ...good, kind: "head", id: "head-9", token: "tk", machine: "pnp-1", enabled: false })).toEqual({ kind: "head", id: "head-9", name: "Feeders left", address: "192.168.0.60:80", token: "tk", machine: "pnp-1", enabled: false });
  });

  it("keeps the token of a node when the field is left empty, by sending the mark the server reads as keep", () => {
    const f = formOf(node("feeder-1"));
    expect(f.token).toBe("");
    expect(changeBody(f).token).toBe(TOKEN_MARK);
    expect(changeBody({ ...f, token: "new" }).token).toBe("new");
    expect(JSON.stringify(f)).not.toContain(TOKEN_MARK);
  });
});

describe("the event of the websocket", () => {
  it("reads a pnp_node event and nothing else", () => {
    expect(nodeEvent('{"type":"pnp_node","id":"feeder-1","health":"silent","ready":false}')).toEqual({ id: "feeder-1", health: "silent", ready: false });
    expect(nodeEvent('{"type":"pnp_node","id":"head-1"}')).toEqual({ id: "head-1", health: "unknown", ready: false });
    for (const raw of ['{"type":"job"}', '{"type":"pnp_node"}', '{"type":"pnp_node","id":4}', "not json", "", "[]", "null"]) expect(nodeEvent(raw), raw).toBeNull();
  });

  it("changes the node it names at once and leaves the others alone", () => {
    const list = [node("a"), node("b")];
    const out = applyNodeEvent(list, { id: "b", health: "silent", ready: false });
    expect(out[0]).toBe(list[0]);
    expect(out[1]).toMatchObject({ id: "b", health: "silent", ready: false });
    expect(applyNodeEvent(list, { id: "zzz", health: "ok", ready: true })).toEqual(list);
  });

  it("never throws and lets through only well-formed events, for messages made from a fixed seed", () => {
    const rng = new SimRng(20260121);
    const pieces = ['{"type":"pnp_node"', ',"id":"x1"', ',"health":"ok"', ',"ready":true', "}", "{", '"', ",,", "[1]", '{"type":1}'];
    for (let i = 0; i < 400; i++) {
      let raw = "";
      for (let n = rng.below(6); n >= 0; n--) raw += pieces[rng.below(pieces.length)];
      const e = nodeEvent(raw);
      if (e !== null) {
        expect(typeof e.id).toBe("string");
        expect(typeof e.ready).toBe("boolean");
      }
    }
  });
});

class FakeSocket implements SocketLike {
  static all: FakeSocket[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((m: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  closed = false;
  constructor(readonly ticket: string) {
    FakeSocket.all.push(this);
  }
  close() {
    this.closed = true;
  }
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("the connection that listens for the nodes", () => {
  it("asks a ticket for each connection, tells when it is live and hands on the events", async () => {
    FakeSocket.all = [];
    const heard: string[] = [];
    const live: boolean[] = [];
    let n = 0;
    const s = new NodeSocket({ ticket: async () => `t${++n}`, open: (t) => new FakeSocket(t) }, (e) => heard.push(`${e.id}:${e.health}`), (v) => live.push(v));
    s.start();
    await flush();
    expect(FakeSocket.all).toHaveLength(1);
    expect(FakeSocket.all[0].ticket).toBe("t1");
    FakeSocket.all[0].onopen?.();
    FakeSocket.all[0].onmessage?.({ data: '{"type":"pnp_node","id":"a","health":"fail","ready":false}' });
    FakeSocket.all[0].onmessage?.({ data: '{"type":"job"}' });
    expect(heard).toEqual(["a:fail"]);
    expect(live).toEqual([true]);
    s.stop();
    expect(FakeSocket.all[0].closed).toBe(true);
    expect(live[live.length - 1]).toBe(false);
  });

  it("mends itself with a wait that doubles up to 30 s, and a new ticket each time", async () => {
    FakeSocket.all = [];
    const waits: number[] = [];
    const pending: (() => void)[] = [];
    let n = 0;
    const s = new NodeSocket(
      {
        ticket: async () => `t${++n}`,
        open: (t) => new FakeSocket(t),
        later: (fn, ms) => {
          waits.push(ms);
          pending.push(fn);
          return () => undefined;
        },
      },
      () => undefined,
    );
    s.start();
    await flush();
    for (let i = 0; i < 8; i++) {
      FakeSocket.all[FakeSocket.all.length - 1].onclose?.();
      pending.shift()?.();
      await flush();
    }
    expect(waits).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000]);
    expect(FakeSocket.all.map((x) => x.ticket)).toEqual(["t1", "t2", "t3", "t4", "t5", "t6", "t7", "t8", "t9"]);
    s.stop();
  });

  it("tries again when the ticket is refused, and does nothing after stop", async () => {
    FakeSocket.all = [];
    const pending: (() => void)[] = [];
    let fail = true;
    const s = new NodeSocket(
      {
        ticket: async () => {
          if (fail) throw new Error("no");
          return "ok";
        },
        open: (t) => new FakeSocket(t),
        later: (fn) => {
          pending.push(fn);
          return () => undefined;
        },
      },
      () => undefined,
    );
    s.start();
    await flush();
    expect(FakeSocket.all).toHaveLength(0);
    fail = false;
    pending.shift()?.();
    await flush();
    expect(FakeSocket.all).toHaveLength(1);
    s.stop();
    FakeSocket.all[0].onclose?.();
    await flush();
    expect(pending).toHaveLength(0);
  });
});

describe("the authorization of a job", () => {
  const hash = "3b1f0000000000000000000000000000000000000000000000000000000000aa";
  const queued = { state: "queued" as const, toolpath_sha256: hash, authorization: null };

  it("says where a job stands with its hash", () => {
    expect(authState({})).toBe("none");
    expect(authState({ toolpath_sha256: "" })).toBe("none");
    expect(authState(queued)).toBe("waiting");
    expect(authState({ toolpath_sha256: hash, authorization: { by: "ana", at: 1, toolpath_sha256: hash } })).toBe("authorized");
    expect(authState({ toolpath_sha256: hash, authorization: { by: "ana", at: 1, toolpath_sha256: "0".repeat(64) } })).toBe("stale");
    expect(shortHash(hash)).toBe("3b1f00000000");
    expect(shortHash(undefined)).toBe("");
  });

  it("offers to authorize only to a person who may, and only while there is a hash nobody authorised", () => {
    expect(jobActions(queued, { role: "operator" })).toEqual(["authorize", "start", "cancel"]);
    expect(jobActions(queued, { role: "viewer" })).toEqual([]);
    expect(jobActions(queued, { role: "operator", scopes: ["jobs:start", "jobs:cancel"] })).toEqual(["start", "cancel"]);
    expect(jobActions({ ...queued, authorization: { by: "ana", at: 1, toolpath_sha256: hash } }, { role: "operator" })).toEqual(["start", "cancel"]);
    expect(jobActions({ state: "queued" }, { role: "operator" })).toEqual(["start", "cancel"]);
    expect(jobActions({ ...queued, state: "running" }, { role: "operator" })).toEqual(["pause", "cancel"]);
  });

  it("sends the hash the person saw with the start and with the authorization, and an empty body otherwise", async () => {
    const s = fakeServer({
      "POST /work/jobs/w-1/authorize": () => ({ id: "w-1", machine: "m", plugin: "pnp", state: "queued", toolpath_sha256: hash }),
      "POST /work/jobs/w-1/start": () => ({ id: "w-1", machine: "m", plugin: "pnp", state: "running" }),
    });
    const w = new WorkClient(new ServiceHttp(() => "t", s.fetcher));
    await w.authorize("w-1", hash);
    await w.start("w-1", hash);
    await w.start("w-1");
    expect(s.calls.map((c) => c.body)).toEqual([{ toolpath_sha256: hash }, { toolpath_sha256: hash }, {}]);
  });
});
