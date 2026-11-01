import { describe, expect, it } from "vitest";
import { Api } from "./api";
import { shouldAlert, titleFor } from "./attention";
import {
  copyId,
  copyNames,
  machineQueue,
  defaultDrillTool,
  drillRequest,
  fileRequest,
  fileSlot,
  finishedIds,
  gcodeLineCount,
  gcodeRequest,
  holesDone,
  keepProgram,
  keptProgram,
  parseToolList,
  prepareRoute,
  resumeHref,
  withSkips,
  jobsCsv,
  kindOfFiles,
  machineExport,
  machineImport,
  matchesQuery,
  nameFromFile,
  parseHoles,
  planBox,
  sortJobs,
  toolColour,
  toolsUsed,
  totals,
  twoSteps,
  waitingJobs,
} from "./jobtools";
import { PAGES, pagesFor, parseRoute } from "./model";
import type { JobSummary } from "./types";

function job(over: Partial<JobSummary>): JobSummary {
  return {
    id: "a",
    machine: "m1",
    name: "board",
    kind: "drill",
    state: "ready",
    created: 100,
    started: null,
    finished: null,
    by: "ana",
    items_total: 10,
    items_done: 0,
    holes_total: 4,
    holes_done: 0,
    message: null,
    pause: null,
    estimate_s: 30,
    ...over,
  };
}

describe("holes typed by hand", () => {
  it("reads tool, x and y, or x and y for the tool 1, and skips comments and blanks", () => {
    const r = parseHoles("# a board\n1 10 10\n\n2, 20.5, 5 # two\n30;40\n");
    expect(r.bad).toEqual([]);
    expect(r.holes).toEqual([
      { tool: 1, x_mm: 10, y_mm: 10 },
      { tool: 2, x_mm: 20.5, y_mm: 5 },
      { tool: 1, x_mm: 30, y_mm: 40 },
    ]);
    expect(toolsUsed(r.holes)).toEqual([1, 2]);
  });
  it("names the lines it cannot read", () => {
    const r = parseHoles("1 2 3\nfoo 1 2\n1 2 3 4\n0 5 5\n7");
    expect(r.holes.length).toBe(1);
    expect(r.bad).toEqual([2, 3, 4, 5]);
  });
  it("builds the request of the server", () => {
    const req = drillRequest("b", 1.6, [defaultDrillTool(1)], [{ tool: 1, x_mm: 1, y_mm: 2 }]);
    expect(req).toEqual({ kind: "drill", name: "b", board_mm: 1.6, tools: [{ number: 1, extra_stroke_mm: 0, feed_mm_min: 1000, spindle_rpm: 24000 }], holes: [{ tool: 1, x_mm: 1, y_mm: 2 }] });
  });
});

describe("files of the programs", () => {
  it("puts each file in its slot by the extension, whatever the case", () => {
    expect(fileSlot("BOARD.NCD")).toBe("ncd");
    expect(fileSlot("a.b.plt")).toBe("plt");
    expect(fileSlot("TOOLS.Dtd")).toBe("dtd");
    expect(fileSlot("notes.txt")).toBeNull();
    expect(fileSlot("noext")).toBeNull();
  });
  it("tells the kind from the files and names the job from the first file", () => {
    expect(kindOfFiles({ ncd: "x", dtd: "y" })).toBe("drill");
    expect(kindOfFiles({ plt: "x" })).toBe("route");
    expect(kindOfFiles({ rtd: "x" })).toBeNull();
    expect(nameFromFile("C:\\jobs\\Board One.NCD")).toBe("Board One");
    expect(fileRequest("drill", "j", { ncd: "n" }, "x")).toEqual({ kind: "drill", name: "j", files: { ncd: "n" }, sorting: "x" });
    expect(fileRequest("route", "j", { plt: "p" }, "x")).toEqual({ kind: "route", name: "j", files: { plt: "p" } });
  });
});

describe("the plan", () => {
  it("has a box with a margin, and a box even when there is nothing", () => {
    expect(planBox({ bounds_mm: [10, 10, 30, 20] })).toEqual({ x: 8, y: 8, w: 24, h: 14 });
    expect(planBox({ bounds_mm: null }).w).toBeGreaterThan(0);
  });
  it("counts the holes done from the item the job has reached", () => {
    const v = { hole_ends: [14, 17, 24] };
    expect([0, 13, 14, 16, 17, 100].map((n) => holesDone(v, n))).toEqual([0, 0, 1, 1, 2, 3]);
  });
  it("gives each tool a colour and repeats them in turn", () => {
    expect(toolColour(1)).not.toBe(toolColour(2));
    expect(toolColour(11)).toBe(toolColour(1));
    expect(toolColour(0)).toBe(toolColour(1));
  });
});

describe("the list of jobs", () => {
  const jobs = [
    job({ id: "1", name: "Alpha board", created: 10, state: "done", started: 20, finished: 80, holes_done: 4 }),
    job({ id: "2", name: "Beta", machine: "m2", created: 30, state: "waiting_operator", started: 40 }),
    job({ id: "3", name: "Gamma", created: 20, state: "failed", by: "luis" }),
    job({ id: "4", name: "Delta", created: 5, state: "waiting_operator", started: 10 }),
  ];
  it("searches in the name, the machine, the person and the state, every word", () => {
    expect(jobs.filter((j) => matchesQuery(j, "alpha")).map((j) => j.id)).toEqual(["1"]);
    expect(jobs.filter((j) => matchesQuery(j, "m2 wait")).map((j) => j.id)).toEqual(["2"]);
    expect(jobs.filter((j) => matchesQuery(j, "LUIS")).map((j) => j.id)).toEqual(["3"]);
    expect(jobs.filter((j) => matchesQuery(j, "  ")).length).toBe(4);
    expect(jobs.filter((j) => matchesQuery(j, "alpha luis")).length).toBe(0);
  });
  it("orders them", () => {
    expect(sortJobs(jobs, "newest").map((j) => j.id)).toEqual(["2", "3", "1", "4"]);
    expect(sortJobs(jobs, "oldest").map((j) => j.id)).toEqual(["4", "1", "3", "2"]);
    expect(sortJobs(jobs, "name").map((j) => j.name)).toEqual(["Alpha board", "Beta", "Delta", "Gamma"]);
    expect(sortJobs(jobs, "machine")[0].machine).toBe("m1");
    expect(jobs[0].id).toBe("1"); // the list given is left as it was
  });
  it("finds the ones that wait, the one that waited longest first, and the ones that are over", () => {
    expect(waitingJobs(jobs).map((j) => j.id)).toEqual(["4", "2"]);
    expect(finishedIds(jobs)).toEqual(["1", "3"]);
  });
  it("adds up what the finished jobs did", () => {
    expect(totals(jobs)).toEqual({ done: 1, failed: 1, holes: 4, seconds: 60 });
  });
  it("makes a CSV that quotes what needs it", () => {
    const csv = jobsCsv([job({ id: "x", name: 'a "b", c', message: "line\nbreak" })]);
    expect(csv.split("\r\n")[0].startsWith("id,name,machine")).toBe(true);
    expect(csv).toContain('"a ""b"", c"');
    expect(csv).toContain('"line\nbreak"');
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("machines moved between servers", () => {
  const m = { id: "b1", name: "Bungard", model: "ccd-mtc", station: "bench", connection: { kind: "node", address: "10.0.0.5:5800" }, dcf: "d", rcf: "r", cfg: "c=1" };
  it("exports without any token and imports what it exported", () => {
    const text = machineExport([m]);
    expect(text).not.toContain("token");
    expect(machineImport(text)).toEqual([{ id: "b1", name: "Bungard", model: "ccd-mtc", station: "bench", connection: { kind: "node", address: "10.0.0.5:5800" }, dcf: "d", rcf: "r", cfg: "c=1" }]);
  });
  it("refuses a file that is not one of ours", () => {
    expect(machineImport("nope")).toBeNull();
    expect(machineImport('{"machines":[]}')).toBeNull();
    expect(machineImport('{"eh3d_machines":1,"machines":[{"name":"x"}]}')).toBeNull();
  });
  it("finds a free id for a copy", () => {
    expect(copyId("bungard", [])).toBe("bungard-2");
    expect(copyId("bungard", ["bungard-2", "bungard-3"])).toBe("bungard-4");
    expect(copyId("bungard-2", ["bungard-2"])).toBe("bungard-3");
    expect(copyId("x".repeat(32), []).length).toBeLessThanOrEqual(32);
  });
});

describe("the address and the alert", () => {
  it("reads the page and what it shows from the address", () => {
    expect(parseRoute("#/jobs")).toEqual({ page: "jobs", param: "" });
    expect(parseRoute("#/job/ab%2012")).toEqual({ page: "job", param: "ab 12" });
    expect(parseRoute("#/nothing")).toEqual({ page: "overview", param: "" });
    expect(parseRoute("")).toEqual({ page: "overview", param: "" });
  });
  it("keeps the job page and the preparation in the right place", () => {
    expect(PAGES.find((p) => p.id === "job")?.hidden).toBe(true);
    expect(pagesFor("viewer").some((p) => p.id === "prepare")).toBe(false);
    expect(pagesFor("operator").some((p) => p.id === "prepare")).toBe(true);
  });
  it("calls the person only when one more job waits, and counts them in the title", () => {
    expect(shouldAlert(0, 1)).toBe(true);
    expect(shouldAlert(2, 2)).toBe(false);
    expect(shouldAlert(2, 1)).toBe(false);
    expect(titleFor(0)).toBe("EH3D Studio");
    expect(titleFor(3)).toBe("(3) EH3D Studio");
  });
  it("asks the server for the preview and for the job on the machine", async () => {
    const calls: string[] = [];
    const api = new Api("t", async (url, init) => {
      calls.push(`${init?.method} ${url}`);
      return new Response(JSON.stringify({ id: "j1", items: 3 }), { status: 200 });
    });
    await api.previewJob("m 1", { kind: "drill" });
    await api.createJob("m 1", { kind: "drill" });
    expect(calls).toEqual(["POST /api/v1/machines/m%201/preview", "POST /api/v1/machines/m%201/jobs"]);
  });
  it("asks the server for the node of the drill head, and the camera picture carries the token in its address", async () => {
    const calls: string[] = [];
    const api = new Api("tok en", async (url, init) => {
      calls.push(`${init?.method} ${url}`);
      return new Response(JSON.stringify({ node: "head-1" }), { status: 200 });
    });
    await api.headStatus("bench-1");
    await api.headMeasure("bench-1");
    await api.headMeasure("bench-1", 5);
    expect(calls).toEqual(["GET /api/v1/machines/bench-1/head/status", "POST /api/v1/machines/bench-1/head/measure", "POST /api/v1/machines/bench-1/head/measure?samples=5"]);
    expect(api.headStreamUrl("bench-1", "t_ab c")).toBe("/api/v1/machines/bench-1/head/stream?ticket=t_ab%20c");
  });
});

describe("one machine and its queue", () => {
  const jobs = [
    job({ id: "1", machine: "a", state: "running", estimate_s: 100 }),
    job({ id: "2", machine: "a", state: "ready", created: 20, estimate_s: 60 }),
    job({ id: "3", machine: "a", state: "ready", created: 10, estimate_s: 40 }),
    job({ id: "4", machine: "a", state: "done", created: 1, finished: 50 }),
    job({ id: "5", machine: "a", state: "failed", created: 2, finished: 90 }),
    job({ id: "6", machine: "b", state: "ready" }),
  ];
  it("splits what is active, what is ready (in the order it was made) and what finished last", () => {
    const q = machineQueue(jobs, "a");
    expect(q.active?.id).toBe("1");
    expect(q.ready.map((j) => j.id)).toEqual(["3", "2"]);
    expect(q.readySeconds).toBe(100);
    expect(q.recent.map((j) => j.id)).toEqual(["5", "4"]);
    expect(machineQueue(jobs, "b").active).toBeNull();
    expect(machineQueue(jobs, "none").ready).toEqual([]);
  });
  it("names the copies of a job", () => {
    expect(copyNames("board", 1)).toEqual(["board"]);
    expect(copyNames("board", 3)).toEqual(["board", "board #2", "board #3"]);
    expect(copyNames("board", 0)).toEqual(["board"]);
    expect(copyNames("board", 500).length).toBe(50);
    expect(copyNames("x".repeat(60), 2)[1].length).toBeLessThanOrEqual(60);
  });
});

describe("free G-code programs and the work that is switched off or already done", () => {
  it("builds the request of a G-code program with the safety switch off unless asked", () => {
    expect(gcodeRequest("frame", "G0 X1\n")).toEqual({ kind: "gcode", name: "frame", gcode: "G0 X1\n" });
    expect(gcodeRequest("frame", "G0 X1\n", 3.9, true)).toEqual({ kind: "gcode", name: "frame", gcode: "G0 X1\n", skip: 3, restore_outputs: true });
    expect(gcodeRequest("frame", "x", 0, false)).not.toHaveProperty("restore_outputs");
  });

  it("counts the lines of a program as skip does, blank and comment lines too", () => {
    expect(gcodeLineCount("")).toBe(0);
    expect(gcodeLineCount("G0 X1")).toBe(1);
    expect(gcodeLineCount("G0 X1\n")).toBe(1);
    expect(gcodeLineCount("(a)\n\nG0 X1\r\nM30\n")).toBe(4);
  });

  it("reads the tools that are switched off", () => {
    expect(parseToolList("5, 2 2;T7")).toEqual({ tools: [2, 5, 7], bad: [] });
    expect(parseToolList("")).toEqual({ tools: [], bad: [] });
    expect(parseToolList("3 x 100 0 1.5")).toEqual({ tools: [3], bad: ["x", "100", "0", "1.5"] });
  });

  it("adds skip_tools and skip to a drilling or routing request only when they say something", () => {
    const r = fileRequest("drill", "board", { ncd: "n", dtd: "d" });
    expect(withSkips(r, [], 0)).toEqual(r);
    expect(withSkips(r, [2, 4], 12.7)).toEqual({ ...r, skip_tools: [2, 4], skip: 12 });
    expect(r).not.toHaveProperty("skip_tools");
  });

  it("carries the line to go on from through the address of Prepare", () => {
    const href = resumeHref("bungard 1", 120, "ab12");
    expect(href).toBe("#/prepare/bungard%201/120/ab12");
    const route = parseRoute(href);
    expect(route.page).toBe("prepare");
    expect(prepareRoute(route.param)).toEqual({ machine: "bungard 1", skip: 120, job: "ab12" });
    expect(prepareRoute("m1")).toEqual({ machine: "m1", skip: 0, job: "" });
    expect(prepareRoute("")).toEqual({ machine: "", skip: 0, job: "" });
  });

  it("keeps a program in the browser for the job that may go on, and does without when there is no store", () => {
    const store = new Map<string, string>();
    const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const real = globalThis.window;
    Object.defineProperty(globalThis, "window", { value: { localStorage: fake }, configurable: true });
    try {
      keepProgram("j1", "frame", "G0 X1\n");
      expect(keptProgram("j1")).toEqual({ name: "frame", text: "G0 X1\n" });
      expect(keptProgram("other")).toBeNull();
      store.set("eh3d.gcode.bad", "{not json");
      expect(keptProgram("bad")).toBeNull();
    } finally {
      Object.defineProperty(globalThis, "window", { value: real, configurable: true });
    }
    // with no store at all neither call throws
    expect(() => keepProgram("j2", "x", "y")).not.toThrow();
  });

  it("exports and imports a GRBL machine with its port and baud rate and no token", () => {
    const m = { id: "g1", name: "Router", model: "ccd-mtc", station: "", connection: { kind: "grbl", address: "COM3", port: "COM3", baud: 57600 }, dcf: "", rcf: "", cfg: "" };
    const file = machineExport([m]);
    expect(file).not.toContain("token");
    expect(machineImport(file)?.[0].connection).toEqual({ kind: "grbl", port: "COM3", baud: 57600 });
  });

  it("puts the line of a G-code job in the CSV", () => {
    const j = { id: "j", machine: "m", name: "n", kind: "gcode", state: "failed", created: 0, started: null, finished: null, by: "x", items_total: 10, items_done: 4, holes_total: 0, holes_done: 0, line: 5, message: null, pause: null, estimate_s: null } as JobSummary;
    const [head, row] = jobsCsv([j]).split("\r\n");
    expect(head.split(",")).toContain("line");
    expect(row.split(",")[head.split(",").indexOf("line")]).toBe("5");
  });
});

describe("the start button asks once more", () => {
  it("arms on the first touch and fires on the second", () => {
    const first = twoSteps(false);
    expect(first).toEqual({ armed: true, fire: false });
    const second = twoSteps(first.armed);
    expect(second).toEqual({ armed: false, fire: true });
    // after firing it is disarmed again: the next touch asks again
    expect(twoSteps(second.armed)).toEqual({ armed: true, fire: false });
  });
});
