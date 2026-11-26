/* The client of the printers: it only reads, it takes a damaged, partial or huge answer without inventing numbers, and the warnings say what a person should know. Everything
 * is tried against a simulated server; nothing here has talked to a real printer. GPL-3.0-or-later. */
import { describe, expect, it } from "vitest";
import { Api } from "../api";
import { SIM_PASSWORD, SimRng, SimServer } from "../simserver";
import { ROWS } from "../texts";
import { ServiceHttp } from "./http";
import {
  PRINTER_HEALTHS,
  PRINTER_STATES,
  PrinterClient,
  healthKey,
  healthTone,
  news,
  parsePrinter,
  parsePrinters,
  remainingParts,
  stateKey,
  stateTone,
  temperatureText,
  warningKey,
  warningsOf,
} from "./printers";
import type { Printer, WarningKind } from "./printers";
import { fakeServer, json } from "./testkit";

const SCHEMA = "eh3d.printers.status/1";

const status = (extra: Record<string, unknown> = {}) => ({
  state: "printing",
  temperatures: [{ name: "nozzle", current_c: 210.4, target_c: 210 }],
  progress_pct: 10,
  remaining_s: 600,
  remaining_estimated: false,
  layer: 2,
  layers: 20,
  job_name: "part",
  alerts: [],
  camera: null,
  ...extra,
});

const raw = (id: string, extra: Record<string, unknown> = {}) => ({ id, name: `Printer ${id}`, family: "moonraker", health: "online", current: true, status: status(), ...extra });

const printer = (id: string, extra: Record<string, unknown> = {}): Printer => parsePrinter(raw(id, extra)) as Printer;

describe("the client of the printers", () => {
  it("only ever reads: one GET, whatever is asked of it", async () => {
    const s = fakeServer({ "GET /printers": () => ({ schema: SCHEMA, printers: [raw("a")] }) });
    const client = new PrinterClient(new ServiceHttp(() => "t", s.fetcher));
    for (let i = 0; i < 3; i++) expect((await client.list())[0].id).toBe("a");
    expect(s.calls.map((c) => `${c.method} ${c.path}`)).toEqual(["GET /printers", "GET /printers", "GET /printers"]);
    expect(s.calls.every((c) => c.body === undefined)).toBe(true);
    expect(Object.keys(client).filter((k) => typeof (client as unknown as Record<string, unknown>)[k] === "function")).toEqual(["list"]);
  });

  it("reads the printers of the simulated server", async () => {
    const sim = new SimServer();
    const api = new Api(null, sim.fetcher);
    await api.login("ana", SIM_PASSWORD);
    const list = await new PrinterClient(new ServiceHttp(() => api.token, sim.fetcher)).list();
    expect(list.map((p) => [p.id, p.health, p.state])).toEqual([
      ["printer-1", "online", "printing"],
      ["printer-2", "offline", null],
    ]);
    expect(list[0].simulated).toBe(true);
    expect(list[0].camera).toBe(true);
  });

  it("gives up in time on a server that says nothing, and says so when it is off", async () => {
    const hang = (_: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
    await expect(new PrinterClient(new ServiceHttp(() => "t", hang, { normal: 20, retries: 0 })).list()).rejects.toMatchObject({ code: "timeout" });
    const off = fakeServer({ "GET /printers": () => json({ error: "printers_off", detail: "" }, 501) });
    await expect(new PrinterClient(new ServiceHttp(() => "t", off.fetcher, { retries: 0 })).list()).rejects.toMatchObject({ code: "printers_off" });
  });

  it("refuses an answer that is not the contract instead of showing no printers", () => {
    for (const bad of [null, 1, "x", [], {}, { printers: [] }, { schema: SCHEMA }, { schema: SCHEMA, printers: {} }, { schema: "eh3d.printers.status/2", printers: [] }]) {
      expect(() => parsePrinters(bad), JSON.stringify(bad)).toThrow();
    }
    expect(parsePrinters({ schema: SCHEMA, printers: [null, 5, {}, { id: "" }, raw("a"), raw("a")] }).map((p) => p.id)).toEqual(["a"]);
    expect(parsePrinters({ schema: SCHEMA, printers: Array.from({ length: 500 }, (_, i) => raw(`p${i}`)) })).toHaveLength(64);
  });

  it("takes what is missing, wrong or impossible as unknown and never as zero", () => {
    const p = printer("a", {
      status: {
        state: "dancing",
        temperatures: [{ name: "nozzle", current_c: Number.NaN, target_c: Infinity }, { name: "bed", current_c: "60", target_c: 1e308 }, { name: "tool9", current_c: 1 }, { name: "nozzle", current_c: 5 }, null, 4],
        progress_pct: 250,
        remaining_s: -1,
        layer: Number.NaN,
        layers: 1e12,
        job_name: `a\u0007\u202eb${"x".repeat(100000)}`,
        alerts: [{ severity: "apocalypse", code: "C" }, null, ...Array.from({ length: 100 }, () => ({ severity: "info", code: "i" }))],
        camera: { present: "yes" },
      },
    });
    expect(p.state).toBe("unknown");
    expect(p.temperatures).toEqual([
      { name: "nozzle", current: null, target: null },
      { name: "bed", current: null, target: null },
    ]);
    expect([p.progress, p.remainingS, p.layer, p.layers, p.camera]).toEqual([null, null, null, null, null]);
    expect(p.job.startsWith("abx")).toBe(true);
    expect([...p.job]).toHaveLength(128);
    expect(p.alerts.length).toBeLessThanOrEqual(32);
    expect(p.alerts[0]).toEqual({ severity: "warning", code: "C", message: "" });
  });

  it("shows nothing of what a printer said unless it is online or its words are old, and never takes a new health as online", () => {
    for (const health of PRINTER_HEALTHS) {
      const p = printer("a", { health });
      expect(p.state !== null, health).toBe(health === "online" || health === "stale");
      expect(p.current, health).toBe(health === "online");
    }
    const odd = printer("a", { health: "excellent" });
    expect([odd.health, odd.state, odd.current]).toEqual(["unknown", null, false]);
    expect(printer("a", { certificate_seen: "<script>" }).certificateSeen).toBe("");
    expect(printer("a", { certificate_seen: "a".repeat(64) }).certificateSeen).toHaveLength(64);
  });

  it("does not fail on made-up answers from a fixed seed", () => {
    const rng = new SimRng(0xdd01);
    const pieces: unknown[] = [null, true, -1, 0, 42, 1e308, "", "online", "printing", "nozzle", [], {}, [null], { present: true }, Number.NaN];
    const pick = () => pieces[rng.below(pieces.length)];
    for (let i = 0; i < 2000; i++) {
      const made = parsePrinter({ id: "x", health: pick(), name: pick(), status: rng.below(2) ? status({ [Object.keys(status())[rng.below(10)]]: pick() }) : pick(), age_s: pick() });
      expect(made).not.toBeNull();
      const p = made as Printer;
      expect(PRINTER_HEALTHS).toContain(p.health);
      if (p.state !== null) expect(PRINTER_STATES).toContain(p.state);
      expect(p.progress === null || (p.progress >= 0 && p.progress <= 100)).toBe(true);
      expect(() => warningsOf([p])).not.toThrow();
    }
  });
});

describe("how a printer is shown", () => {
  it("has a text in the eight languages for every health, state and warning", () => {
    const warnings: WarningKind[] = ["emergency", "error", "failed", "alert", "paused", "refused", "untrusted", "bad_report", "offline", "stale"];
    for (const key of [...PRINTER_HEALTHS.map(healthKey), ...PRINTER_STATES.map(stateKey), ...warnings.map(warningKey)]) {
      expect(ROWS, key).toHaveProperty(key);
      expect((ROWS[key] as readonly string[]).length, key).toBe(8);
    }
  });

  it("has a tone for every health and state, and only online is in order", () => {
    expect(PRINTER_HEALTHS.filter((h) => healthTone(h) === "ok")).toEqual(["online"]);
    expect(PRINTER_STATES.filter((s) => stateTone(s) === "bad")).toEqual(["failed", "error", "emergency"]);
  });

  it("writes the time left and the temperatures", () => {
    expect(remainingParts(0)).toEqual({ h: 0, m: 0 });
    expect(remainingParts(1)).toEqual({ h: 0, m: 1 });
    expect(remainingParts(4980)).toEqual({ h: 1, m: 23 });
    expect(temperatureText({ current: 219.6, target: 220 })).toBe("220 / 220 °C");
    expect(temperatureText({ current: null, target: null })).toBe("- °C");
    expect(temperatureText({ current: null, target: 60 })).toBe("- / 60 °C");
  });
});

describe("the warnings", () => {
  it("say nothing for a printer in order, switched off or never read", () => {
    expect(warningsOf([printer("a"), printer("b", { health: "disabled" }), printer("c", { health: "off" }), printer("d", { health: "unknown" })])).toEqual([]);
  });

  it("say what is wrong and how serious it is", () => {
    const list = [
      printer("a", { health: "offline" }),
      printer("b", { health: "untrusted" }),
      printer("c", { status: status({ state: "emergency", alerts: [{ severity: "error", code: "klipper_shutdown", message: "Timer too close" }] }) }),
      printer("d", { status: status({ state: "paused", alerts: [{ severity: "info", code: "I" }] }) }),
    ];
    expect(warningsOf(list).map((w) => [w.printer, w.kind, w.serious, w.detail])).toEqual([
      ["Printer a", "offline", false, ""],
      ["Printer b", "untrusted", true, ""],
      ["Printer c", "emergency", true, ""],
      ["Printer c", "alert", true, "klipper_shutdown Timer too close"],
      ["Printer d", "paused", false, ""],
    ]);
  });

  it("tell only what is new, and the print that finished", () => {
    const printing = [printer("a"), printer("b", { health: "offline" })];
    expect(news(printing, printing)).toEqual({ warnings: [], finished: [] });
    const after = [printer("a", { status: status({ state: "finished" }) }), printer("b", { health: "offline" }), printer("c", { status: status({ state: "failed" }) })];
    const told = news(printing, after);
    expect(told.finished).toEqual(["Printer a"]);
    expect(told.warnings.map((w) => `${w.printer} ${w.kind}`)).toEqual(["Printer c failed"]);
    expect(news(after, after).finished).toEqual([]);
  });
});
