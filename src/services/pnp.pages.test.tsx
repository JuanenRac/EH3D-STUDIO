// @vitest-environment jsdom
/* The tab of the nodes of the pick-and-place machines and the authorization of a job, drawn in a small DOM against a server that answers from a table of routes that keeps the
 * nodes in memory (a simulator: nothing here has talked to a real feeder or head). */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkPage } from "../pages/WorkPage";
import type { Role } from "../types";
import { Providers, fakeServer, makeApp, makeServices, refusal } from "./testkit";
import type { Handler } from "./testkit";
import { TOKEN_MARK } from "./pnp";
import type { PnpNode } from "./pnp";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let box: HTMLElement | null = null;

beforeEach(() => {
  box = document.createElement("div");
  document.body.appendChild(box);
});

afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = null;
  box?.remove();
  box = null;
});

async function settle(times = 6) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

async function show(role: Role, routes: Record<string, Handler>) {
  const server = fakeServer(routes);
  root = createRoot(box!);
  await act(async () => root!.render(<Providers app={makeApp(role)} services={makeServices(server.fetcher, role)}><WorkPage route="" /></Providers>));
  await settle();
  return { server, text: () => box!.textContent ?? "", $: (s: string) => box!.querySelector(s), $$: (s: string) => [...box!.querySelectorAll(s)] };
}

const button = (name: string) => [...box!.querySelectorAll("button")].find((b) => b.textContent?.trim() === name) as HTMLButtonElement | undefined;

async function click(el: Element | undefined | null) {
  expect(el, "the element to click").toBeTruthy();
  await act(async () => (el as HTMLElement).click());
  await settle();
}

async function type(el: Element | null, value: string) {
  expect(el, "the field to fill").toBeTruthy();
  const input = el as HTMLInputElement;
  const proto = input instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? "change" : "input", { bubbles: true }));
  });
}

const tab = (p: { $$: (s: string) => Element[] }, name: string) => p.$$("[role=tab]").find((t) => t.textContent === name);

const LIMITS = { max: 16, poll_s: 5, silence_s: 30, timeout_s: 3, kinds: ["feeder", "head"] };

function node(id: string, kind: "feeder" | "head", extra: Partial<PnpNode> = {}): PnpNode {
  return { id, kind, name: `Node ${id}`, address: "192.168.0.60:80", token: TOKEN_MARK, machine: "pnp-1", enabled: true, health: "ok", ready: true, polls: { ok: 7, failed: 1 }, last_error: "", status: null, evidence: "simulator", ...extra };
}

/** A simulator of the nodes: it keeps the list, refuses what the server refuses and shows a token only as the mark. */
function simulator(start: PnpNode[]) {
  const list = start.map((n) => ({ ...n }));
  const log: string[] = [];
  const routes: Record<string, Handler> = {
    "GET /work/machines": () => ({ machines: [{ id: "pnp-1", name: "Placer", plugin: "pnp", state: "idle" }] }),
    "GET /plugins": () => ({ plugins: [{ kind: "pnp", title: "Pick and place", capabilities: {}, manages_machines: true }] }),
    "GET /work/jobs": () => ({ total: 0, offset: 0, limit: 100, items: [] }),
    "GET /notifications": () => ({ notifications: [] }),
    "GET /pnp/nodes": () => ({ nodes: list, summary: {}, limits: LIMITS }),
    "POST /pnp/nodes": (c) => {
      const b = c.body as { kind: "feeder" | "head"; id?: string; name: string; address: string; token?: string; machine?: string };
      if (list.some((n) => n.address === b.address)) return refusal(409, "pnp_node_exists");
      const id = b.id || `${b.kind}-${list.length + 1}`;
      const made = node(id, b.kind, { name: b.name, address: b.address, token: b.token ? TOKEN_MARK : "", machine: b.machine ?? "", health: "unknown", ready: false });
      list.push(made);
      log.push(`add ${id} token=${b.token ? "given" : "none"}`);
      return made;
    },
    "PUT /pnp/nodes/feeder-1": (c) => {
      const b = c.body as { name?: string; token?: string };
      const n = list.find((x) => x.id === "feeder-1")!;
      if (b.name) n.name = b.name;
      log.push(`change feeder-1 token=${b.token === TOKEN_MARK ? "kept" : "new"}`);
      return n;
    },
    "DELETE /pnp/nodes/feeder-1": () => {
      list.splice(list.findIndex((x) => x.id === "feeder-1"), 1);
      log.push("remove feeder-1");
      return { ok: true };
    },
    "POST /pnp/nodes/feeder-1/poll": () => {
      const n = list.find((x) => x.id === "feeder-1")!;
      n.polls = { ok: n.polls.ok + 1, failed: n.polls.failed };
      log.push("poll feeder-1");
      return n;
    },
  };
  return { routes, log, list };
}

describe("the tab of the nodes of the pick-and-place machines", () => {
  const start = () => [node("feeder-1", "feeder", { status: { safe: false, selfcheck: "ok", online: 3, slots: 4, low: 1, empty: 0, faulted: 0 } }), node("head-1", "head", { health: "silent", ready: false, last_error: "unreachable", status: { safe: false, selfcheck: "warn", nozzle_count: 2, pump: true, faulted: 1 } })];

  it("shows a viewer every node with its health, readiness and facts, and no button", async () => {
    const sim = simulator(start());
    const p = await show("viewer", sim.routes);
    await click(tab(p, "Nodes"));
    expect(p.text()).toContain("Node feeder-1");
    expect(p.text()).toContain("2 nodes · 1 ready · 1 not ready");
    expect(p.text()).toContain("In order");
    expect(p.text()).toContain("Silent");
    expect(p.text()).toContain("Feeders 3/4 · low 1 · empty 0 · faulted 0");
    expect(p.text()).toContain("Nozzles 2 · pump on · faulted 1");
    expect(p.text()).toContain("self-check: warn");
    expect(p.text()).toContain("unreachable");
    expect(p.text()).toContain("7 / 1");
    expect(button("Ask now")).toBeUndefined();
    expect(button("Edit")).toBeUndefined();
    expect(button("Delete")).toBeUndefined();
    expect(button("Register a node")).toBeUndefined();
  });

  it("never shows a token, only whether the node has one", async () => {
    const sim = simulator(start());
    const p = await show("admin", sim.routes);
    await click(tab(p, "Nodes"));
    expect(p.text()).not.toContain(TOKEN_MARK);
    expect(p.text()).toContain("token set");
    await click(button("Edit"));
    const token = p.$("input[type=password]") as HTMLInputElement;
    expect(token.value).toBe("");
    expect(JSON.stringify([...p.$$("input")].map((i) => (i as HTMLInputElement).value))).not.toContain(TOKEN_MARK);
  });

  it("lets an operator ask a node now and nothing more", async () => {
    const sim = simulator(start());
    const p = await show("operator", sim.routes);
    await click(tab(p, "Nodes"));
    expect(button("Edit")).toBeUndefined();
    expect(button("Register a node")).toBeUndefined();
    await click(button("Ask now"));
    expect(sim.log).toEqual(["poll feeder-1"]);
    expect(p.text()).toContain("8 / 1");
  });

  it("asks twice before an administrator registers, changes or removes a node", async () => {
    const sim = simulator(start());
    const p = await show("admin", sim.routes);
    await click(tab(p, "Nodes"));
    // remove: the first touch only arms the button
    await click(button("Delete"));
    expect(sim.log).toEqual([]);
    expect(button("Sure?")).toBeTruthy();
    await click(button("Sure?"));
    expect(sim.log).toEqual(["remove feeder-1"]);
    expect(p.text()).not.toContain("Node feeder-1");
    // register: the form is checked before anything is sent, and the save asks twice
    await click(button("Register a node"));
    expect(button("Save")?.disabled).toBe(true);
    const fields = p.$$("input:not([type=checkbox]):not([type=password])") as HTMLInputElement[];
    await type(fields[1], "Feeders right");
    await type(fields[2], "192.168.0.61:80");
    await type(p.$("input[type=password]"), "secret-for-the-test");
    expect(button("Save")?.disabled).toBe(false);
    await click(button("Save"));
    expect(sim.log).toEqual(["remove feeder-1"]);
    await click(button("Sure?"));
    expect(sim.log).toEqual(["remove feeder-1", "add feeder-2 token=given"]);
    expect(p.text()).toContain("Feeders right");
    expect(p.text()).not.toContain("secret-for-the-test");
    expect(p.text()).not.toContain(TOKEN_MARK);
  });

  it("keeps the token of a node that is changed with the field left empty", async () => {
    const sim = simulator(start());
    const p = await show("admin", sim.routes);
    await click(tab(p, "Nodes"));
    await click(p.$$("button").find((b) => b.textContent === "Edit"));
    const fields = p.$$("input:not([type=checkbox]):not([type=password])") as HTMLInputElement[];
    await type(fields[1], "Feeders left");
    await click(button("Save"));
    await click(button("Sure?"));
    expect(sim.log).toEqual(["change feeder-1 token=kept"]);
    expect(p.text()).toContain("Feeders left");
  });

  it("says in the words of the server that the nodes are off, and shows the empty list", async () => {
    const off = simulator([]);
    off.routes["GET /pnp/nodes"] = () => refusal(501, "pnp_nodes_off");
    const p = await show("viewer", off.routes);
    await click(tab(p, "Nodes"));
    expect(p.text()).toContain("The nodes of the pick-and-place machines are switched off on this server.");
    await act(async () => root!.unmount());
    root = null;
    const none = await show("admin", simulator([]).routes);
    await click(tab(none, "Nodes"));
    expect(none.text()).toContain("No node is registered.");
    expect(button("Register a node")).toBeTruthy();
  });

  it("keeps the form open and says why when the server refuses the address", async () => {
    const sim = simulator(start());
    const p = await show("admin", sim.routes);
    await click(tab(p, "Nodes"));
    await click(button("Register a node"));
    const fields = p.$$("input:not([type=checkbox]):not([type=password])") as HTMLInputElement[];
    await type(fields[1], "Same address");
    await type(fields[2], "192.168.0.60:80");
    await click(button("Save"));
    await click(button("Sure?"));
    expect(sim.log).toEqual([]);
    expect(button("Save")).toBeTruthy();
    expect((p.$$("input:not([type=checkbox]):not([type=password])")[1] as HTMLInputElement).value).toBe("Same address");
  });
});

describe("the authorization of a job in the queue", () => {
  const HASH = "3b1f0000000000000000000000000000000000000000000000000000000000aa";
  const JOB = { id: "w-1", machine: "pnp-1", plugin: "pnp", name: "Board A", state: "queued", position: 1, owner: "ana", created: 1700000000, toolpath_sha256: HASH, authorization: null };
  const routes = (job: Record<string, unknown>, calls: string[]): Record<string, Handler> => ({
    "GET /work/machines": () => ({ machines: [{ id: "pnp-1", name: "Placer", plugin: "pnp", state: "idle" }] }),
    "GET /plugins": () => ({ plugins: [] }),
    "GET /work/jobs": () => ({ total: 1, offset: 0, limit: 100, items: [job] }),
    "GET /work/jobs/w-1": () => ({ ...job, history: [] }),
    "GET /notifications": () => ({ notifications: [] }),
    "POST /work/jobs/w-1/authorize": (c) => {
      calls.push(`authorize ${(c.body as { toolpath_sha256: string }).toolpath_sha256}`);
      return { ...job, authorization: { by: "ana", at: 1700000100, toolpath_sha256: HASH } };
    },
    "POST /work/jobs/w-1/start": (c) => {
      calls.push(`start ${JSON.stringify(c.body)}`);
      return { ...job, state: "running" };
    },
  });

  it("shows the hash and that nobody has authorized the job, and offers the button to an operator only", async () => {
    const calls: string[] = [];
    const viewer = await show("viewer", routes(JOB, calls));
    expect(viewer.text()).toContain("Not authorized");
    expect(viewer.text()).toContain(HASH.slice(0, 12));
    expect(button("Authorize")).toBeUndefined();
    await act(async () => root!.unmount());
    root = null;
    await show("operator", routes(JOB, calls));
    expect(button("Authorize")).toBeTruthy();
    expect(button("Start")).toBeTruthy();
  });

  it("asks twice to authorize, sends the hash it showed, and sends the same hash with the start", async () => {
    const calls: string[] = [];
    const p = await show("operator", routes(JOB, calls));
    await click(button("Authorize"));
    expect(calls).toEqual([]);
    await click(button("Sure?"));
    expect(calls).toEqual([`authorize ${HASH}`]);
    await click(button("Start"));
    await click(button("Sure?"));
    expect(calls).toEqual([`authorize ${HASH}`, `start ${JSON.stringify({ toolpath_sha256: HASH })}`]);
    expect(p.server.calls.filter((c) => c.method === "POST").length).toBe(2);
  });

  it("does not offer to authorize a job that is authorized, and shows who authorized it", async () => {
    const done = { ...JOB, authorization: { by: "bea", at: 1700000100, toolpath_sha256: HASH } };
    const p = await show("operator", routes(done, []));
    expect(p.text()).toContain("Authorized");
    expect(button("Authorize")).toBeUndefined();
    await click(p.$$("button.link")[0]);
    expect(p.text()).toContain("authorized by bea");
  });

  it("shows a stale authorization as out of date and offers to authorize again", async () => {
    const stale = { ...JOB, authorization: { by: "bea", at: 1700000100, toolpath_sha256: "0".repeat(64) } };
    const p = await show("operator", routes(stale, []));
    expect(p.text()).toContain("Authorization out of date");
    expect(button("Authorize")).toBeTruthy();
  });

  it("says why the start was refused and opens the job when the hash is not the one that was shown", async () => {
    const calls: string[] = [];
    const r = routes(JOB, calls);
    r["POST /work/jobs/w-1/start"] = () => refusal(409, "stale_authorization");
    const p = await show("operator", r);
    await click(button("Start"));
    await click(button("Sure?"));
    expect(p.$$("button.link")[0].getAttribute("aria-expanded")).toBe("true");
    expect(p.text()).toContain(HASH);
  });

  it("leaves a job without a hash as it was: no badge, no authorize button, an empty body to start", async () => {
    const calls: string[] = [];
    const bare = { id: "w-2", machine: "pnp-1", plugin: "pnp", name: "Old", state: "queued", position: 1, owner: "ana", created: 1700000000 };
    const r = routes(bare, calls);
    r["GET /work/jobs"] = () => ({ total: 1, offset: 0, limit: 100, items: [bare] });
    r["POST /work/jobs/w-2/start"] = (c) => {
      calls.push(`start ${JSON.stringify(c.body)}`);
      return { ...bare, state: "running" };
    };
    const p = await show("operator", r);
    expect(p.text()).not.toContain("Not authorized");
    expect(button("Authorize")).toBeUndefined();
    await click(button("Start"));
    await click(button("Sure?"));
    expect(calls).toEqual(["start {}"]);
  });
});

describe("the nodes that are asked too slowly", () => {
  const slow = [node("head-1", "head", { link_lost_ms: 2000, link_lost_declared: false, poll_too_slow: true }), node("feeder-1", "feeder", { link_lost_ms: 15000, link_lost_declared: true, poll_too_slow: false })];

  it("are told with their times, and what to change", async () => {
    const sim = simulator(slow);
    sim.routes["GET /pnp/nodes"] = () => ({ nodes: slow, summary: {}, limits: LIMITS, warnings: [{ code: "poll_too_slow", node: "head-1", poll_s: 5, link_lost_ms: 2000, link_lost_declared: false }] });
    const p = await show("viewer", sim.routes);
    await click(tab(p, "Nodes"));
    expect(p.text()).toContain("Node head-1: asked every 5 s, but it goes to its safe state after 2000 ms without being asked.");
    expect(p.text()).toContain("The node has not said its time");
    expect(p.text()).toContain("pnp_node_poll_s");
    expect(p.text()).toContain("Asked too slowly");
    expect(p.text()).toContain("safe after 2000 ms without the server (assumed)");
    expect(p.text()).toContain("safe after 15000 ms without the server");
  });

  it("say nothing when the server sends no warning", async () => {
    const p = await show("viewer", simulator([node("feeder-1", "feeder")]).routes);
    await click(tab(p, "Nodes"));
    expect(p.text()).not.toContain("Nodes asked too slowly");
    expect(p.text()).not.toContain("without the server");
  });
});
