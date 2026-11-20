import { describe, expect, it } from "vitest";
import { ROWS } from "../texts";
import { ServiceHttp } from "./http";
import { INTERLOCK_TEXT, SWITCH_NOTES, detailFacts, interlocks, isSimulatorOnly, needsManualStart, releaseRoute, safetyActions, startsByItself, stopRoute } from "./safety";
import { fakeServer } from "./testkit";
import { WorkClient } from "./work";
import type { Who } from "./permissions";

const viewer: Who = { role: "viewer" };
const operator: Who = { role: "operator" };
const admin: Who = { role: "admin" };
const SIM = { evidence: "simulator", simulator_only: true };

describe("a machine that has only run against a simulator", () => {
  it("is recognised by the flag, by the evidence of its detail and by the evidence of its plugin", () => {
    expect(isSimulatorOnly({ simulator_only: true })).toBe(true);
    expect(isSimulatorOnly({ evidence: "simulator" })).toBe(true);
    expect(isSimulatorOnly(undefined, { evidence: "simulator" })).toBe(true);
    expect(isSimulatorOnly(null, null)).toBe(false);
    expect(isSimulatorOnly({ evidence: "hardware", simulator_only: false }, { evidence: "bench" })).toBe(false);
    expect(isSimulatorOnly({})).toBe(false);
  });
});

describe("the interlocks of a machine", () => {
  it("lists the latch, the latch of an emergency stop and the alarm, in that order", () => {
    expect(interlocks({ alarm: true, estop_latched: true, latched: true })).toEqual(["latched", "estop_latched", "alarm"]);
    expect(interlocks({ estop_latched: true })).toEqual(["estop_latched"]);
    expect(interlocks({ latched: true })).toEqual(["latched"]);
  });

  it("reads an alarm from a flag, from a text and from the state word of a CNC machine, and nothing from a quiet machine", () => {
    expect(interlocks({ alarm: "limit switch" })).toEqual(["alarm"]);
    expect(interlocks({ state_word: "Alarm" })).toEqual(["alarm"]);
    expect(interlocks({ state_word: " alarm " })).toEqual(["alarm"]);
    for (const quiet of [{ alarm: false }, { alarm: "" }, { alarm: "none" }, { alarm: "OK" }, { state_word: "Idle" }, { state_word: "Run" }, { latched: false, estop_latched: false }, {}]) {
      expect(interlocks(quiet), JSON.stringify(quiet)).toEqual([]);
    }
    expect(interlocks(null)).toEqual([]);
    expect(interlocks(undefined)).toEqual([]);
  });

  it("has a text in Studio for every interlock", () => {
    for (const text of Object.values(INTERLOCK_TEXT)) expect(ROWS).toHaveProperty(text);
  });
});

describe("the routes of the plugins", () => {
  it("stop with a route of their own only the CNC machine and the 3D printer, and release the three that latch", () => {
    expect(stopRoute("cnc")).toBe("emergency-stop");
    expect(stopRoute("printer3d")).toBe("emergency-stop");
    for (const p of ["laser", "pnp", "pcb", "gerber", "cam", "vision", "cad", "demo", "bungard"]) expect(stopRoute(p), p).toBeNull();
    expect(releaseRoute("cnc")).toBe("release");
    expect(releaseRoute("printer3d")).toBe("release");
    expect(releaseRoute("laser")).toBe("laser/release");
    for (const p of ["pnp", "pcb", "gerber", "cam", "vision", "cad", "demo"]) expect(releaseRoute(p), p).toBeNull();
  });
});

describe("the safe actions of a person on a machine", () => {
  it("gives an operator the emergency stop of a CNC machine and of a 3D printer even when nothing runs, and none to a viewer", () => {
    expect(safetyActions(operator, "cnc", SIM, null)).toEqual(["emergency_stop"]);
    expect(safetyActions(operator, "printer3d", SIM, null)).toEqual(["emergency_stop"]);
    expect(safetyActions(viewer, "cnc", SIM, "j1")).toEqual([]);
    expect(safetyActions(null, "cnc", SIM, "j1")).toEqual([]);
  });

  it("gives the emergency stop of the other plugins only while a job runs on the machine", () => {
    expect(safetyActions(operator, "laser", SIM, null)).toEqual([]);
    expect(safetyActions(operator, "laser", SIM, "")).toEqual([]);
    expect(safetyActions(operator, "laser", SIM, "j1")).toEqual(["emergency_stop"]);
    expect(safetyActions(operator, "pnp", SIM, "j1")).toEqual(["emergency_stop"]);
  });

  it("gives the release of a latch to an administrator only, and not the emergency stop of a machine that is already held", () => {
    const latched = { ...SIM, latched: true };
    expect(safetyActions(admin, "printer3d", latched, null)).toEqual(["release"]);
    expect(safetyActions(operator, "printer3d", latched, null)).toEqual([]);
    expect(safetyActions(admin, "laser", { ...SIM, estop_latched: true }, null)).toEqual(["release"]);
    expect(safetyActions(admin, "cnc", { ...SIM, state_word: "Alarm" }, null)).toEqual(["release"]);
  });

  it("offers no release for a plugin that has no route for it, and none for a machine that is free", () => {
    expect(safetyActions(admin, "pnp", { ...SIM, latched: true }, null)).toEqual([]);
    expect(safetyActions(admin, "cnc", SIM, null)).toEqual(["emergency_stop"]);
  });

  it("follows the scopes of a token: a scope narrows a role and never widens it", () => {
    expect(safetyActions({ role: "admin", scopes: ["machines:view"] }, "cnc", SIM, "j1")).toEqual([]);
    expect(safetyActions({ role: "operator", scopes: ["jobs:start"] }, "cnc", SIM, "j1")).toEqual([]);
    expect(safetyActions({ role: "operator", scopes: ["jobs:cancel"] }, "cnc", SIM, "j1")).toEqual(["emergency_stop"]);
    expect(safetyActions({ role: "viewer", scopes: ["jobs:cancel", "machines:manage"] }, "cnc", { latched: true }, "j1")).toEqual([]);
  });
});

describe("the start of a job", () => {
  it("is a touch of a person for a 3D printer, and a machine that starts its queue by itself is told apart", () => {
    expect(needsManualStart("printer3d")).toBe(true);
    for (const p of ["laser", "cnc", "pnp", "demo", "bungard"]) expect(needsManualStart(p), p).toBe(false);
    expect(startsByItself({ auto_start_queue: true })).toBe(true);
    expect(startsByItself({ auto_start: true })).toBe(true);
    expect(startsByItself({ auto_start_queue: false })).toBe(false);
    expect(startsByItself(undefined)).toBe(false);
  });
});

describe("what else a plugin says of its machine", () => {
  it("shows numbers, flags and short texts in the order of the plugin, and leaves out what the page shows in its own way", () => {
    const facts = detailFacts({ evidence: "simulator", simulator_only: true, latched: false, power: 40, beam_on: false, mode: "cut", note: "x".repeat(41), position_mm: [1, 2], bed_mm: { x: 1 }, none: null });
    expect(facts).toEqual([
      { key: "power", value: "40" },
      { key: "beam_on", value: "false" },
      { key: "mode", value: "cut" },
    ]);
  });

  it("keeps at most the number asked for and nothing from a machine with no detail", () => {
    expect(detailFacts({ a: 1, b: 2, c: 3, d: 4 }, 2).map((f) => f.key)).toEqual(["a", "b"]);
    expect(detailFacts({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 })).toHaveLength(6);
    expect(detailFacts(undefined)).toEqual([]);
    expect(detailFacts(null)).toEqual([]);
  });
});

describe("the switches of security that the server brings off", () => {
  it("are four, each with a text of its own", () => {
    expect(Object.keys(SWITCH_NOTES).sort()).toEqual(["compat_api", "compat_write", "mdns_announce", "slice_enabled"]);
    for (const text of Object.values(SWITCH_NOTES)) expect(ROWS).toHaveProperty(text);
  });
});

describe("the emergency stop and the release through the client", () => {
  const client = (routes: Parameters<typeof fakeServer>[0]) => {
    const s = fakeServer(routes);
    return { s, work: new WorkClient(new ServiceHttp(() => "tok", s.fetcher, { retries: 0 }, async () => undefined)) };
  };
  const ok = () => ({ ok: true });

  it("stop a CNC machine and a 3D printer by the route of their plugin, with no body", async () => {
    const { s, work } = client({ "POST /work/machines/cnc-1/emergency-stop": ok, "POST /work/machines/print-1/emergency-stop": ok });
    await work.emergencyStop("cnc-1", "cnc", null);
    await work.emergencyStop("print-1", "printer3d", "j9");
    expect(s.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /work/machines/cnc-1/emergency-stop", "POST /work/machines/print-1/emergency-stop"]);
    expect(s.calls.every((c) => c.body === undefined || c.body === null)).toBe(true);
  });

  it("stop a laser by cancelling its job, and ask for nothing when no job runs and the plugin has no route", async () => {
    const { s, work } = client({ "POST /work/jobs/j1/cancel": ok });
    await work.emergencyStop("laser-1", "laser", "j1");
    expect(s.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["POST /work/jobs/j1/cancel"]);
    expect(await work.emergencyStop("laser-1", "laser", null)).toBeNull();
    expect(await work.emergencyStop("pnp-1", "pnp")).toBeNull();
    expect(s.calls).toHaveLength(1);
  });

  it("release the latch by the route of the plugin, escape a machine name and ask for nothing when the plugin does not latch", async () => {
    const { s, work } = client({ "POST /work/machines/laser-1/laser/release": ok, "POST /work/machines/cnc-1/release": ok, "POST /work/machines/a%20b/release": ok });
    await work.release("laser-1", "laser");
    await work.release("cnc-1", "cnc");
    await work.release("a b", "printer3d");
    expect(await work.release("pnp-1", "pnp")).toBeNull();
    expect(s.calls.map((c) => c.path)).toEqual(["/work/machines/laser-1/laser/release", "/work/machines/cnc-1/release", "/work/machines/a%20b/release"]);
  });

  it("let the refusal of the server reach the caller", async () => {
    const { work } = client({ "POST /work/machines/cnc-1/release": () => new Response(JSON.stringify({ error: "forbidden", detail: "" }), { status: 403 }) });
    await expect(work.release("cnc-1", "cnc")).rejects.toMatchObject({ status: 403, code: "forbidden" });
  });
});
