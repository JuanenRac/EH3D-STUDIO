import { describe, expect, it } from "vitest";
import {
  copyId,
  copyNames,
  fileSlot,
  finishedIds,
  gcodeLineCount,
  gcodeRequest,
  holeRadius,
  holesDone,
  isWebLink,
  jobsCsv,
  kindOfFiles,
  machineExport,
  machineImport,
  machineQueue,
  matchesQuery,
  nameFromFile,
  parseHoles,
  parseToolList,
  planBox,
  prepareRoute,
  resumeHref,
  sortJobs,
  TOOL_COLOURS,
  toolColour,
  toolsUsed,
  took,
  totals,
  twoSteps,
  waitingJobs,
  withSkips,
} from "./jobtools";
import { atLeast, isPageId, pagesFor, parseRoute } from "./model";
import { whenText } from "./services/format";
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
  it("refuses numbers written in hexadecimal, binary or octal", () => {
    for (const line of ["0x10 5", "0b11 1", "0o7 7", "1 0x10 5", "1 2 0X1F", "5 0B1"]) {
      const r = parseHoles(line);
      expect(r.holes, line).toEqual([]);
      expect(r.bad, line).toEqual([1]);
    }
  });

  it("reads the decimal forms of a number and the separators of a line", () => {
    const r = parseHoles("1e2 3e-1\n.5 -.5\n+1 +2\n3 1.5 2.5\n7;8\n9,10\n 1\t2 \n5. 6.");
    expect(r.bad).toEqual([]);
    expect(r.holes).toEqual([
      { tool: 1, x_mm: 100, y_mm: 0.3 },
      { tool: 1, x_mm: 0.5, y_mm: -0.5 },
      { tool: 1, x_mm: 1, y_mm: 2 },
      { tool: 3, x_mm: 1.5, y_mm: 2.5 },
      { tool: 1, x_mm: 7, y_mm: 8 },
      { tool: 1, x_mm: 9, y_mm: 10 },
      { tool: 1, x_mm: 1, y_mm: 2 },
      { tool: 1, x_mm: 5, y_mm: 6 },
    ]);
  });

  it("refuses the words and the digits of other scripts that Number would not read as a plain number", () => {
    for (const line of ["Infinity 1", "-Infinity 1", "NaN 1", "1 inf", "١ ٢", "１ ２", "1 2e", "e5 1", "1_0 2", "1..5 2", "--1 2", "1 +-2", "- 1"]) {
      expect(parseHoles(line).bad, line).toEqual([1]);
    }
  });

  it("keeps the tool inside 1 to 99 and whole", () => {
    expect(parseHoles("1 1 1\n99 1 1").bad).toEqual([]);
    expect(parseHoles("0 1 1\n100 1 1\n1.5 1 1\n-1 1 1\n1e1 1 1").bad).toEqual([1, 2, 3, 4]);
    expect(parseHoles("1e1 1 1").holes[0].tool).toBe(10);
  });

  it("counts a line with one number or with four as bad, and a comment or a blank as nothing", () => {
    expect(parseHoles("5").bad).toEqual([1]);
    expect(parseHoles("1 2 3 4").bad).toEqual([1]);
    expect(parseHoles(", ;").bad).toEqual([1]);
    expect(parseHoles("# only a comment\n   \n\t\n")).toEqual({ holes: [], bad: [] });
    expect(parseHoles("")).toEqual({ holes: [], bad: [] });
    expect(parseHoles("1,5 2,5").bad).toEqual([1]);
  });

  it("numbers the bad lines from one through carriage returns and comments", () => {
    const r = parseHoles("# header\r\n1 2 3\r\nbad line\r\n\r\n4 5\r\nx\r\n");
    expect(r.bad).toEqual([3, 6]);
    expect(r.holes).toHaveLength(2);
  });

  it("reads twenty thousand lines without failing", () => {
    const text = Array.from({ length: 20000 }, (_, i) => `${(i % 99) + 1} ${i} ${i * 2}`).join("\n");
    const r = parseHoles(text);
    expect(r.bad).toEqual([]);
    expect(r.holes).toHaveLength(20000);
    expect(toolsUsed(r.holes)).toHaveLength(99);
  });

  it("lists the tools used once and in order", () => {
    expect(toolsUsed([])).toEqual([]);
    expect(
      toolsUsed([
        { tool: 5, x_mm: 0, y_mm: 0 },
        { tool: 2, x_mm: 0, y_mm: 0 },
        { tool: 5, x_mm: 1, y_mm: 1 },
        { tool: 10, x_mm: 1, y_mm: 1 },
      ]),
    ).toEqual([2, 5, 10]);
  });
});

describe("a list of tools", () => {
  it("takes each tool once, in order, with or without the T", () => {
    expect(parseToolList("2, 5 7")).toEqual({ tools: [2, 5, 7], bad: [] });
    expect(parseToolList("T3 t4 3 03")).toEqual({ tools: [3, 4], bad: [] });
    expect(parseToolList("99 1")).toEqual({ tools: [1, 99], bad: [] });
    expect(parseToolList("")).toEqual({ tools: [], bad: [] });
    expect(parseToolList(" , ; ")).toEqual({ tools: [], bad: [] });
  });

  it("names every word that is not a whole number from 1 to 99", () => {
    const r = parseToolList("0 100 x 1.5 0x10 -2 T 0b1 Infinity NaN 1e1");
    expect(r.bad).toEqual(["0", "100", "x", "1.5", "0x10", "-2", "T", "0b1", "Infinity", "NaN"]);
    expect(r.tools).toEqual([10]);
  });
});

describe("the address of a job that goes on", () => {
  it("reads the machine, the line and the job and takes a line that is not a plain whole number as zero", () => {
    expect(prepareRoute("m1/12/j")).toEqual({ machine: "m1", skip: 12, job: "j" });
    expect(prepareRoute("m1")).toEqual({ machine: "m1", skip: 0, job: "" });
    expect(prepareRoute("")).toEqual({ machine: "", skip: 0, job: "" });
    for (const skip of ["0x10", "-3", "1.5", "abc", "0", " 7", "7 ", "NaN", "Infinity"]) {
      expect(prepareRoute(`m1/${skip}/j`).skip, skip).toBe(0);
    }
    expect(prepareRoute("a/5/c/d/e")).toEqual({ machine: "a", skip: 5, job: "c" });
  });

  it("goes round through the address and back", () => {
    const href = resumeHref("m 1", 12, "j-1");
    expect(href).toBe("#/prepare/m%201/12/j-1");
    expect(prepareRoute(parseRoute(href).param)).toEqual({ machine: "m 1", skip: 12, job: "j-1" });
  });

  it("does not stop on an address with a damaged escape", () => {
    for (const hash of ["#/job/%zz", "#/job/%", "#/job/%E0%A4%A", "#/job/%%", "#/prepare/%ff/1/%c0%af", "#/jobs/%u0041"]) {
      expect(() => parseRoute(hash), hash).not.toThrow();
    }
    expect(parseRoute("#/job/%zz")).toEqual({ page: "job", param: "%zz" });
    expect(parseRoute("#/job/a%2Fb")).toEqual({ page: "job", param: "a/b" });
    expect(parseRoute("#/job/ab%2012")).toEqual({ page: "job", param: "ab 12" });
  });

  it("goes to the overview for a page that does not exist, whatever the case, and for an empty address", () => {
    for (const hash of ["", "#", "#/", "#//jobs", "#/JOBS", "#/constructor", "#/__proto__", "#/toString", "#/jobs ", "#/%6Aobs"]) {
      expect(parseRoute(hash).page, hash).toBe("overview");
    }
    expect(parseRoute("jobs").page).toBe("jobs");
  });

  it("knows only the pages of the menu", () => {
    for (const bad of ["", "__proto__", "constructor", "hasOwnProperty", "Jobs", "jobs/1"]) {
      expect(isPageId(bad), bad).toBe(false);
    }
    expect(isPageId("jobs")).toBe(true);
  });

  it("gives every role the pages of the roles below it and no others", () => {
    const ids = (role: "viewer" | "operator" | "admin") => pagesFor(role).map((p) => p.id);
    expect(ids("viewer").every((id) => ids("operator").includes(id))).toBe(true);
    expect(ids("operator").every((id) => ids("admin").includes(id))).toBe(true);
    expect(ids("viewer").length).toBeLessThan(ids("admin").length);
    expect(atLeast("viewer", "admin")).toBe(false);
    expect(atLeast("admin", "viewer")).toBe(true);
    expect(atLeast("operator", "operator")).toBe(true);
  });
});

describe("a link that came from the server", () => {
  it("is a link of the page only for http and https without a name or a password in front of the host", () => {
    for (const ok of ["https://github.com/JuanenRac/EH3D-STUDIO", "http://127.0.0.1:8080/x", "http://host:8080/x?y=1#z", "https://[::1]/", "HTTPS://X.EXAMPLE/"]) {
      expect(isWebLink(ok), ok).toBe(true);
    }
    for (const bad of [
      "https://trusted.example@evil.example/",
      "https://user:secret@host/",
      "http://:pw@host/",
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<b>x</b>",
      "//evil.example",
      "ftp://host/file",
      "file:///etc/passwd",
      "blob:https://x.example/id",
      "mailto:a@b.example",
      "https:",
      "https://exa mple.com",
      "",
      " ",
      "x",
    ]) {
      expect(isWebLink(bad), bad).toBe(false);
    }
    expect(isWebLink(null)).toBe(false);
    expect(isWebLink(undefined)).toBe(false);
  });
});

describe("the names of files and copies", () => {
  it("cuts a name at sixty characters and never inside a character of two units", () => {
    const emoji = "\u{1f600}".repeat(61);
    const name = nameFromFile(`${emoji}.ncd`);
    expect(Array.from(name)).toHaveLength(60);
    expect(() => encodeURIComponent(name)).not.toThrow();
    expect(nameFromFile(`${"a".repeat(80)}.ncd`)).toHaveLength(60);
    expect(nameFromFile(`${"a".repeat(60)}.ncd`)).toBe("a".repeat(60));
  });

  it("takes the name from the last part of a path of either slash without its last extension", () => {
    expect(nameFromFile("a.b.c")).toBe("a.b");
    expect(nameFromFile(".ncd")).toBe("");
    expect(nameFromFile("x/y\\z.plt")).toBe("z");
    expect(nameFromFile("")).toBe("");
    expect(nameFromFile("dir/")).toBe("");
  });

  it("makes the copies of a job with names that stay inside sixty characters", () => {
    expect(copyNames("board", 3)).toEqual(["board", "board #2", "board #3"]);
    const names = copyNames("\u{1f600}".repeat(60), 50);
    expect(names).toHaveLength(50);
    for (const n of names.slice(1)) {
      expect(Array.from(n).length).toBeLessThanOrEqual(60);
      expect(() => encodeURIComponent(n)).not.toThrow();
    }
  });

  it("makes between one and fifty copies whatever number is asked", () => {
    expect(copyNames("a", Number.NaN)).toHaveLength(1);
    expect(copyNames("a", 0)).toHaveLength(1);
    expect(copyNames("a", -5)).toHaveLength(1);
    expect(copyNames("a", 2.9)).toHaveLength(2);
    expect(copyNames("a", Number.POSITIVE_INFINITY)).toHaveLength(50);
    expect(copyNames("a", 1e9)).toHaveLength(50);
  });

  it("finds a free id for a copy of a machine within thirty-two characters", () => {
    expect(copyId("bungard", [])).toBe("bungard-2");
    expect(copyId("bungard-2", ["bungard-2"])).toBe("bungard-3");
    expect(copyId("bungard-7", ["bungard-2", "bungard-3"])).toBe("bungard-4");
    expect(copyId("a".repeat(40), [])).toHaveLength(32);
    const taken = Array.from({ length: 998 }, (_, i) => `m-${i + 2}`);
    expect(copyId("m", taken)).toBe("m-copy");
  });
});

describe("the CSV of the jobs", () => {
  const cells = (row: string) => row.split(",");

  it("writes a header and a row for each job with the line ends of a spreadsheet", () => {
    const text = jobsCsv([job({ id: "a" }), job({ id: "b" })]);
    const lines = text.split("\r\n");
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("");
    expect(cells(lines[0])).toHaveLength(16);
    expect(cells(lines[1])).toHaveLength(16);
    expect(jobsCsv([])).toBe("id,name,machine,kind,state,by,created,started,finished,items_done,items_total,holes_done,holes_total,line,estimate_s,message\r\n");
  });

  it("puts a quote before a text that a spreadsheet would run as a formula", () => {
    for (const name of ["=1+1", "+1", "-1", "@SUM(A1)", "\t=1", "\r=1", "=HYPERLINK(\"x\")"]) {
      const row = jobsCsv([job({ name })]).split("\r\n")[1];
      expect(row.includes("'" + name.replace(/"/g, '""')), name).toBe(true);
    }
    expect(cells(jobsCsv([job({ name: "=1+1" })]).split("\r\n")[1])[1]).toBe("'=1+1");
    expect(cells(jobsCsv([job({ message: "-5 lines" })]).split("\r\n")[1])[15]).toBe("'-5 lines");
  });

  it("does not put a quote before a number, even a negative one, or before an ordinary text", () => {
    const row = cells(jobsCsv([job({ name: "plain", created: -5, estimate_s: null })]).split("\r\n")[1]);
    expect(row[1]).toBe("plain");
    expect(row[6]).toBe("-5");
    expect(row[14]).toBe("");
  });

  it("quotes a cell with a comma, a semicolon, a quote or a line break and doubles the quotes", () => {
    const row = (name: string) => jobsCsv([job({ name })]).split("\r\n")[1];
    expect(row("a,b")).toContain(',"a,b",');
    expect(row("a;b")).toContain(',"a;b",');
    expect(row('say "hi"')).toContain(',"say ""hi""",');
    expect(jobsCsv([job({ name: "a\nb" })])).toContain('"a\nb"');
    expect(row("-a,b")).toContain(`,"'-a,b",`);
  });
});

describe("what a program asks for and how long it is", () => {
  it("counts the lines the way the server numbers them", () => {
    for (const [text, n] of [
      ["", 0],
      ["a", 1],
      ["a\n", 1],
      ["a\n\n", 2],
      ["a\r\nb\r\n", 2],
      ["\n", 1],
      ["\r\n", 1],
      ["a\nb", 2],
    ] as [string, number][]) {
      expect(gcodeLineCount(text), JSON.stringify(text)).toBe(n);
    }
  });

  it("leaves out a line to skip that is not a positive number and cuts a fraction", () => {
    for (const skip of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(gcodeRequest("n", "G0", skip).skip, String(skip)).toBeUndefined();
      expect(withSkips({ kind: "drill", name: "n" }, [], skip).skip, String(skip)).toBeUndefined();
    }
    expect(gcodeRequest("n", "G0", 2.9).skip).toBe(2);
    expect(withSkips({ kind: "drill", name: "n" }, [], 7.5).skip).toBe(7);
    expect(withSkips({ kind: "drill", name: "n" }, [], 1).skip_tools).toBeUndefined();
    expect(withSkips({ kind: "drill", name: "n" }, [3, 4], 0).skip_tools).toEqual([3, 4]);
    expect(gcodeRequest("n", "G0").restore_outputs).toBeUndefined();
    expect(gcodeRequest("n", "G0", 0, true).restore_outputs).toBe(true);
  });

  it("does not change the request it was given", () => {
    const base = { kind: "drill" as const, name: "n" };
    withSkips(base, [1], 5);
    expect(base).toEqual({ kind: "drill", name: "n" });
  });

  it("tells the slot of a file by its last extension and nothing else", () => {
    for (const [name, slot] of [
      ["a.ncd", "ncd"],
      ["A.NCD", "ncd"],
      ["a.ncd ", "ncd"],
      ["a.rtd", "rtd"],
      ["a.PLT", "plt"],
      ["dir.plt/a.dtd", "dtd"],
      ["a.ncd.exe", null],
      ["ncd", null],
      ["a.nc", null],
      ["", null],
      ["a.", null],
    ] as [string, string | null][]) {
      expect(fileSlot(name), name).toBe(slot);
    }
    expect(kindOfFiles({})).toBeNull();
    expect(kindOfFiles({ plt: "x" })).toBe("route");
    expect(kindOfFiles({ ncd: "x", plt: "y" })).toBe("drill");
  });
});

describe("the plan of a job", () => {
  it("has a box for a drawing with nothing, with damaged bounds or with bounds that are upside down", () => {
    const empty = { x: 0, y: 0, w: 100, h: 80 };
    expect(planBox({ bounds_mm: null })).toEqual(empty);
    expect(planBox({ bounds_mm: [0, 0, Number.NaN, 5] })).toEqual(empty);
    expect(planBox({ bounds_mm: [0, 0, Number.POSITIVE_INFINITY, 5] })).toEqual(empty);
    expect(planBox({ bounds_mm: [0, 0, 5] as unknown as [number, number, number, number] })).toEqual(empty);
    const flipped = planBox({ bounds_mm: [10, 10, 0, 0] });
    expect(flipped.w).toBe(5);
    expect(flipped.h).toBe(5);
    expect(planBox({ bounds_mm: [0, 0, 10, 20] }, 0)).toEqual({ x: 0, y: 0, w: 10, h: 20 });
    expect(planBox({ bounds_mm: [1, 1, 1, 1] }, 0)).toEqual({ x: 1, y: 1, w: 1, h: 1 });
  });

  it("counts the holes finished at an item", () => {
    const view = { hole_ends: [1, 3, 3, 7] };
    expect(holesDone(view, 0)).toBe(0);
    expect(holesDone(view, 1)).toBe(1);
    expect(holesDone(view, 3)).toBe(3);
    expect(holesDone(view, 6)).toBe(3);
    expect(holesDone(view, 7)).toBe(4);
    expect(holesDone(view, 1e9)).toBe(4);
    expect(holesDone({ hole_ends: [] }, 5)).toBe(0);
    expect(holesDone({} as { hole_ends: number[] }, 5)).toBe(0);
  });

  it("takes the colour of a tool in turn and the first one for a tool that is not a number", () => {
    expect(toolColour(1)).toBe(TOOL_COLOURS[0]);
    expect(toolColour(10)).toBe(TOOL_COLOURS[9]);
    expect(toolColour(11)).toBe(TOOL_COLOURS[0]);
    expect(toolColour(1.9)).toBe(TOOL_COLOURS[0]);
    for (const tool of [0, -3, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(toolColour(tool), String(tool)).toBe(TOOL_COLOURS[0]);
    }
    expect(TOOL_COLOURS).toHaveLength(10);
  });

  it("draws a hole at least a third of a millimetre wide and larger on a large box", () => {
    expect(holeRadius({ x: 0, y: 0, w: 15, h: 15 })).toBe(0.35);
    expect(holeRadius({ x: 0, y: 0, w: 300, h: 10 })).toBe(2);
    expect(holeRadius({ x: 0, y: 0, w: 0, h: 0 })).toBe(0.35);
  });
});

describe("the list of jobs", () => {
  it("matches every word of the query in any field, ignoring the case, and everything for an empty query", () => {
    const j = job({ name: "Board One", machine: "bungard", by: "ana", state: "running" });
    expect(matchesQuery(j, "")).toBe(true);
    expect(matchesQuery(j, "   ")).toBe(true);
    expect(matchesQuery(j, "BOARD")).toBe(true);
    expect(matchesQuery(j, "ana bungard")).toBe(true);
    expect(matchesQuery(j, "ana  running")).toBe(true);
    expect(matchesQuery(j, "ana zzz")).toBe(false);
    expect(matchesQuery(j, "one board")).toBe(true);
  });

  it("sorts without touching the list it was given and by the order asked", () => {
    const a = job({ id: "a", name: "b", created: 1, machine: "y", items_done: 1, items_total: 10 });
    const b = job({ id: "b", name: "a", created: 3, machine: "x", items_done: 9, items_total: 10 });
    const c = job({ id: "c", name: "c", created: 2, machine: "x", items_done: 0, items_total: 0 });
    const list = [a, b, c];
    const ids = (order: Parameters<typeof sortJobs>[1]) => sortJobs(list, order).map((j) => j.id);
    expect(ids("newest")).toEqual(["b", "c", "a"]);
    expect(ids("oldest")).toEqual(["a", "c", "b"]);
    expect(ids("name")).toEqual(["b", "a", "c"]);
    expect(ids("machine")).toEqual(["b", "c", "a"]);
    expect(ids("progress")).toEqual(["b", "a", "c"]);
    expect(list.map((j) => j.id)).toEqual(["a", "b", "c"]);
  });

  it("lists the jobs that wait for the operator, the one that has waited longest first", () => {
    const list = [
      job({ id: "late", state: "waiting_operator", started: 50 }),
      job({ id: "early", state: "waiting_operator", started: null, created: 10 }),
      job({ id: "run", state: "running", started: 1 }),
    ];
    expect(waitingJobs(list).map((j) => j.id)).toEqual(["early", "late"]);
    expect(waitingJobs([])).toEqual([]);
  });

  it("tells the finished jobs and how long they took", () => {
    const list = [job({ id: "1", state: "done" }), job({ id: "2", state: "failed" }), job({ id: "3", state: "cancelled" }), job({ id: "4", state: "running" })];
    expect(finishedIds(list)).toEqual(["1", "2", "3"]);
    expect(took({ started: 5, finished: 9 })).toBe(4);
    expect(took({ started: 5, finished: 5 })).toBe(0);
    expect(took({ started: 9, finished: 5 })).toBeNull();
    expect(took({ started: null, finished: 5 })).toBeNull();
    expect(took({ started: 5, finished: null })).toBeNull();
  });

  it("adds up the finished jobs and leaves out the time of one that has no times", () => {
    const list = [
      job({ state: "done", holes_done: 4, started: 10, finished: 20 }),
      job({ state: "done", holes_done: 3, started: null, finished: null }),
      job({ state: "failed", holes_done: 9 }),
      job({ state: "running", holes_done: 2 }),
    ];
    expect(totals(list)).toEqual({ done: 2, failed: 1, holes: 7, seconds: 10 });
    expect(totals([])).toEqual({ done: 0, failed: 0, holes: 0, seconds: 0 });
  });

  it("splits the jobs of one machine into the active one, the ready ones in order and the last finished", () => {
    const list = [
      job({ id: "r2", state: "ready", created: 20, estimate_s: 5 }),
      job({ id: "r1", state: "ready", created: 10, estimate_s: null }),
      job({ id: "act", state: "running" }),
      job({ id: "d1", state: "done", finished: 5 }),
      job({ id: "d2", state: "done", finished: 9 }),
      job({ id: "other", machine: "m2", state: "running" }),
    ];
    const q = machineQueue(list, "m1", 1);
    expect(q.active?.id).toBe("act");
    expect(q.ready.map((j) => j.id)).toEqual(["r1", "r2"]);
    expect(q.recent.map((j) => j.id)).toEqual(["d2"]);
    expect(q.readySeconds).toBe(5);
    expect(machineQueue([], "m1")).toEqual({ active: null, ready: [], recent: [], readySeconds: 0 });
  });
});

describe("the machines moved between servers", () => {
  it("refuses a file that is not one", () => {
    for (const text of ["", "null", "[]", "{}", "5", '"x"', "{", '{"eh3d_machines":2,"machines":[]}', '{"eh3d_machines":1,"machines":"x"}', '{"eh3d_machines":1,"machines":[null]}', '{"eh3d_machines":1,"machines":[{"id":5,"name":"x"}]}', '{"eh3d_machines":1,"machines":[{"id":"a"}]}']) {
      expect(machineImport(text), text).toBeNull();
    }
  });

  it("fills what a machine leaves out with the defaults and takes a connection that is not known as a demo", () => {
    const list = machineImport('{"eh3d_machines":1,"machines":[{"id":"a","name":"A"},{"id":"b","name":"B","connection":{"kind":"serial"}},{"id":"c","name":"C","connection":{"kind":"grbl","baud":"fast"}}]}');
    expect(list).not.toBeNull();
    expect(list?.[0]).toEqual({ id: "a", name: "A", model: "ccd-mtc", station: "", connection: { kind: "demo" }, dcf: "", rcf: "", cfg: "" });
    expect(list?.[1].connection).toEqual({ kind: "demo" });
    expect(list?.[2].connection).toEqual({ kind: "grbl", port: "", baud: 115200 });
  });

  it("writes a machine of a node and reads it back the same", () => {
    const machines = [{ id: "n1", name: "Node", model: "ccd-mtc", station: "s1", connection: { kind: "node", address: "http://10.0.0.5:8081" }, dcf: "d", rcf: "r", cfg: "c" }];
    const text = machineExport(machines);
    expect(text.endsWith("\n")).toBe(true);
    const back = machineImport(text);
    expect(back).toEqual([{ ...machines[0], connection: { kind: "node", address: "http://10.0.0.5:8081" } }]);
    expect(machineExport(back as unknown as typeof machines)).toBe(text);
  });
});

describe("small things", () => {
  it("shows no time for a number that is not a time", () => {
    for (const s of [null, undefined, 0, -5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, 1e20, 8.64e13]) {
      expect(whenText(s), String(s)).toBe("-");
    }
    for (const s of [1, 1_700_000_000, 8.64e12]) {
      const text = whenText(s);
      expect(text, String(s)).not.toBe("-");
      expect(text, String(s)).not.toContain("Invalid");
    }
  });

  it("arms a button on the first touch and fires on the second", () => {
    expect(twoSteps(false)).toEqual({ armed: true, fire: false });
    expect(twoSteps(true)).toEqual({ armed: false, fire: true });
  });
});
