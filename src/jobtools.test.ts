import { describe, expect, it } from "vitest";
import { Api } from "./api";
import { shouldAlert, titleFor } from "./attention";
import {
  copyId,
  defaultDrillTool,
  drillRequest,
  fileRequest,
  fileSlot,
  finishedIds,
  holesDone,
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
});
