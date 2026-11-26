// @vitest-environment jsdom
/* The tab of the printers, drawn in a small DOM against a server that answers from a table of routes (a simulator: nothing here has talked to a real printer). */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { WorkPage } from "../pages/WorkPage";
import { SIM_PRINTERS } from "../simserver";
import { Providers, fakeServer, makeApp, makeServices, refusal } from "./testkit";
import type { Handler } from "./testkit";

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

async function show(printers: Handler) {
  const server = fakeServer({
    "GET /work/machines": () => ({ machines: [] }),
    "GET /plugins": () => ({ plugins: [] }),
    "GET /work/jobs": () => ({ total: 0, offset: 0, limit: 100, items: [] }),
    "GET /notifications": () => ({ notifications: [] }),
    "GET /printers": printers,
  });
  const said: string[] = [];
  const app = { ...makeApp("admin"), say: (message: string) => said.push(message) };
  const services = makeServices(server.fetcher, "admin");
  root = createRoot(box!);
  await act(async () => root!.render(<Providers app={app} services={services}><WorkPage route="printers" /></Providers>));
  await settle();
  return { server, said, text: () => box!.textContent ?? "", $$: (s: string) => [...box!.querySelectorAll(s)] };
}

async function refresh() {
  const button = [...box!.querySelectorAll("[role=tabpanel] button")].find((b) => b.textContent?.trim() === "Refresh") as HTMLButtonElement;
  await act(async () => button.click());
  await settle();
}

describe("the tab of the printers", () => {
  it("shows the state of each printer and has no control, even for an administrator", async () => {
    const p = await show(() => SIM_PRINTERS);
    for (const words of ["Simulated A", "Printing", "Nozzle: 220 / 220 °C", "42 %", "1 h 23 min left", "layer 50 of 120", "SIMULATOR ONLY", "Simulated B", "Not reachable", "The printer does not answer."]) {
      expect(p.text(), words).toContain(words);
    }
    expect(p.$$("[role=tabpanel] button").map((b) => b.textContent?.trim())).toEqual(["Refresh"]);
    expect(p.$$("[role=tabpanel] input, [role=tabpanel] select, [role=tabpanel] form")).toEqual([]);
    expect(p.$$("[role=alert]")).toHaveLength(1);
    expect(p.said).toEqual([]);
    const printerCalls = p.server.calls.filter((c) => c.path.startsWith("/printers"));
    expect(printerCalls.map((c) => c.method)).toEqual(["GET"]);
  });

  it("tells a new alert once, keeps the last list when the server fails and says that it is old", async () => {
    let turn = 0;
    const base = SIM_PRINTERS.printers[0];
    const p = await show(() => {
      turn += 1;
      if (turn === 1) return SIM_PRINTERS;
      if (turn >= 4) return refusal(503, "unavailable", "the server is starting");
      return { ...SIM_PRINTERS, printers: [{ ...base, status: { ...base.status, state: "paused", alerts: [{ severity: "error", code: "HMS_0300_0100_0001_0007", message: "" }] } }] };
    });
    await refresh();
    expect(p.said).toEqual(["Simulated A: The print is paused.", "Simulated A: Alert of the printer: HMS_0300_0100_0001_0007"]);
    expect(p.text()).toContain("HMS_0300_0100_0001_0007");
    await refresh();
    expect(p.said).toHaveLength(2);
    await refresh();
    expect(p.text()).toContain("The list below is the last one that was read.");
    expect(p.text()).toContain("Simulated A");
  });

  it("says in the words of the language that the list is off, and refuses an answer it does not understand", async () => {
    const off = await show(() => refusal(501, "printers_off", ""));
    expect(off.text()).toContain("The list of printers is switched off on this server.");
    await act(async () => root!.unmount());
    const odd = await show(() => ({ printers: [] }));
    expect(odd.text()).not.toContain("No printer is registered");
    await act(async () => root!.unmount());
    const none = await show(() => ({ schema: "eh3d.printers.status/1", printers: [] }));
    expect(none.text()).toContain("No printer is registered on the server.");
  });
});
