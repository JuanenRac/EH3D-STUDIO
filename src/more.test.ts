import { afterEach, describe, expect, it, vi } from "vitest";
import {
  copyId,
  copyNames,
  fileRequest,
  fileSlot,
  gcodeLineCount,
  gcodeRequest,
  holeRadius,
  holesDone,
  forgetPrograms,
  jobsCsv,
  KEPT_COUNT,
  keepProgram,
  keptProgram,
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
  toolColour,
  TOOL_COLOURS,
  totals,
  took,
  waitingJobs,
  withSkips,
} from "./jobtools";
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

describe("holes typed by hand, from the edges", () => {
  it("counts the lines from 1 including the blank and the comment ones, and takes CRLF and tabs", () => {
    const r = parseHoles("# header\r\n\r\n1\t2\t3\r\nx y\r\n   \r\n4 5\r\n");
    expect(r.holes).toEqual([
      { tool: 1, x_mm: 2, y_mm: 3 },
      { tool: 1, x_mm: 4, y_mm: 5 },
    ]);
    expect(r.bad).toEqual([4]);
  });

  it("takes any mix of separators, empty fields between them and a comment at the end of a line", () => {
    expect(parseHoles("2;3,,4 # the third one").holes).toEqual([{ tool: 2, x_mm: 3, y_mm: 4 }]);
    expect(parseHoles("1 ;; 2").holes).toEqual([{ tool: 1, x_mm: 1, y_mm: 2 }]);
  });

  it("accepts the tools 1 to 99 only, whole, and says no to the rest by their line", () => {
    const r = parseHoles(["0 1 1", "1 1 1", "99 1 1", "100 1 1", "1.5 1 1", "-1 1 1", "2e0 1 1"].join("\n"));
    expect(r.holes.map((h) => h.tool)).toEqual([1, 99, 2]);
    expect(r.bad).toEqual([1, 4, 5, 6]);
  });

  it("refuses what is not a finite number, a lone separator and the wrong number of words", () => {
    const r = parseHoles(["nan 1", "Infinity 1 1", "1 -Infinity", "1 2 3 4", "5", ";", "1 2x", "1 2"].join("\n"));
    expect(r.bad).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(r.holes).toEqual([{ tool: 1, x_mm: 1, y_mm: 2 }]);
  });

  it("keeps negative and fractional coordinates exactly", () => {
    expect(parseHoles("3 -12.5 0.001").holes).toEqual([{ tool: 3, x_mm: -12.5, y_mm: 0.001 }]);
    expect(parseHoles("-0.5 -0.25").holes).toEqual([{ tool: 1, x_mm: -0.5, y_mm: -0.25 }]);
  });

  it("gives nothing for an empty text or one of comments only", () => {
    expect(parseHoles("")).toEqual({ holes: [], bad: [] });
    expect(parseHoles("# a\n# b\n\n")).toEqual({ holes: [], bad: [] });
  });
});

describe("the tools that are switched off", () => {
  it("takes T in either case, drops repeats, sorts, and names the words that are not tools", () => {
    expect(parseToolList("T5 t7 5, 3;t3")).toEqual({ tools: [3, 5, 7], bad: [] });
    expect(parseToolList("T 0 100 1.5 -2 abc 12")).toEqual({ tools: [12], bad: ["T", "0", "100", "1.5", "-2", "abc"] });
    expect(parseToolList("")).toEqual({ tools: [], bad: [] });
    expect(parseToolList(" , ; ")).toEqual({ tools: [], bad: [] });
  });

  it("puts the skips in a request only when they say something, and never changes the request it was given", () => {
    const base = { kind: "drill", name: "x" } as const;
    expect(withSkips(base, [], 0)).toEqual(base);
    expect(withSkips(base, [], -4)).toEqual(base);
    expect(withSkips(base, [], NaN)).toEqual(base);
    expect(withSkips(base, [2, 5], 7.9)).toEqual({ ...base, skip_tools: [2, 5], skip: 7 });
    expect(Object.keys(base)).toEqual(["kind", "name"]);
  });
});

describe("a G-code program and the address that goes on with it", () => {
  it("counts lines the way skip counts them", () => {
    expect(gcodeLineCount("")).toBe(0);
    expect(gcodeLineCount("\n")).toBe(1);
    expect(gcodeLineCount("\n\n")).toBe(2);
    expect(gcodeLineCount("a")).toBe(1);
    expect(gcodeLineCount("a\n\nb")).toBe(3);
    expect(gcodeLineCount("a\r\nb\r\n")).toBe(2);
    expect(gcodeLineCount("G1 X1\nG1 X2\n; end")).toBe(3);
  });

  it("whole lines are skipped and a negative or empty skip is no skip", () => {
    expect(gcodeRequest("p", "G0 X0", 3.9)).toEqual({ kind: "gcode", name: "p", gcode: "G0 X0", skip: 3 });
    expect(gcodeRequest("p", "G0 X0", -3)).toEqual({ kind: "gcode", name: "p", gcode: "G0 X0" });
    expect(gcodeRequest("p", "G0 X0", 0, true)).toEqual({ kind: "gcode", name: "p", gcode: "G0 X0", restore_outputs: true });
    expect(gcodeRequest("p", "G0 X0").restore_outputs).toBeUndefined();
  });

  it("reads the address of Prepare back, and a line that is not a whole number above 0 is the start", () => {
    expect(prepareRoute("m1/5/j9")).toEqual({ machine: "m1", skip: 5, job: "j9" });
    expect(prepareRoute("m1")).toEqual({ machine: "m1", skip: 0, job: "" });
    expect(prepareRoute("")).toEqual({ machine: "", skip: 0, job: "" });
    for (const bad of ["-3", "2.5", "abc", "0", "1e400"]) {
      expect(prepareRoute(`m1/${bad}/j`).skip).toBe(0);
    }
    expect(prepareRoute("m1/5/j/extra").job).toBe("j");
  });

  it("makes an address that carries the line and the job", () => {
    const href = resumeHref("m-1", 42, "job-7");
    expect(href).toBe("#/prepare/m-1/42/job-7");
    expect(prepareRoute(href.replace("#/prepare/", ""))).toEqual({ machine: "m-1", skip: 42, job: "job-7" });
    // a slash in a name cannot cut the address into more parts
    expect(resumeHref("a/b", 1, "c/d").split("/").length).toBe(5);
  });
});

describe("a program kept in the browser", () => {
  afterEach(() => vi.unstubAllGlobals());

  function store(initial: Record<string, string> = {}) {
    const data = { ...initial };
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => (k in data ? data[k] : null),
        setItem: (k: string, v: string) => {
          data[k] = v;
        },
      },
    });
    return data;
  }

  it("keeps a text under the id of the job, and what it gives back is what it was given", () => {
    const data = store();
    const text = "G1 X1 ; ñ 日本\r\nM2\n";
    keepProgram("j1", "pieza ñ.nc", text);
    expect(Object.keys(data)).toEqual(["eh3d.gcode.j1"]);
    expect(keptProgram("j1")).toEqual({ name: "pieza ñ.nc", text });
    expect(keptProgram("other")).toBeNull();
  });

  it("does not keep what is too big, and keeps the limit itself", () => {
    const data = store();
    keepProgram("big", "b", "x".repeat(1_500_001));
    expect(data).toEqual({});
    keepProgram("edge", "e", "x".repeat(1_500_000));
    expect(Object.keys(data)).toEqual(["eh3d.gcode.edge"]);
  });

  it("reads a damaged entry as nothing instead of failing", () => {
    store({
      "eh3d.gcode.a": "{not json",
      "eh3d.gcode.b": JSON.stringify({ name: 3, text: "x" }),
      "eh3d.gcode.c": JSON.stringify({ name: "n" }),
      "eh3d.gcode.d": "null",
      "eh3d.gcode.e": "[]",
    });
    for (const id of ["a", "b", "c", "d", "e"]) expect(keptProgram(id), id).toBeNull();
  });

  it("does without a store that refuses to write", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("full");
        },
      },
    });
    expect(() => keepProgram("j", "n", "t")).not.toThrow();
    expect(keptProgram("j")).toBeNull();
    expect(() => forgetPrograms()).not.toThrow();
  });

  function listed(initial: Record<string, string> = {}) {
    const data = { ...initial };
    vi.stubGlobal("window", {
      localStorage: {
        get length() {
          return Object.keys(data).length;
        },
        key: (i: number) => Object.keys(data)[i] ?? null,
        getItem: (k: string) => (k in data ? data[k] : null),
        setItem: (k: string, v: string) => {
          data[k] = v;
        },
        removeItem: (k: string) => {
          delete data[k];
        },
      },
    });
    return data;
  }

  it("keeps only the newest programs, never the one just written, and leaves other entries of the store alone", () => {
    vi.useFakeTimers();
    try {
      const data = listed({ "eh3d-studio.lang": "es" });
      for (let i = 0; i < KEPT_COUNT + 3; i++) {
        vi.setSystemTime(1_000 + i);
        keepProgram(`j${i}`, "n", "t");
      }
      const kept = Object.keys(data).filter((k) => k.startsWith("eh3d.gcode."));
      expect(kept).toHaveLength(KEPT_COUNT);
      expect(kept).not.toContain("eh3d.gcode.j0");
      expect(kept).toContain(`eh3d.gcode.j${KEPT_COUNT + 2}`);
      expect(data["eh3d-studio.lang"]).toBe("es");
      // a program written with an older clock than the rest is still the one that stays
      vi.setSystemTime(1);
      keepProgram("late", "n", "t");
      expect(keptProgram("late")).toEqual({ name: "n", text: "t" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("forgets every kept program and nothing else when the person signs out", () => {
    const data = listed({ "eh3d-studio.theme": "dark", "eh3d.gcode.a": "{}", "eh3d.gcode.b": "x" });
    forgetPrograms();
    expect(data).toEqual({ "eh3d-studio.theme": "dark" });
  });
});

describe("files and names", () => {
  it("tells the slot by the last extension only, in any case, ignoring spaces at the end", () => {
    expect(fileSlot("BOARD.NCD")).toBe("ncd");
    expect(fileSlot("a.b.plt  ")).toBe("plt");
    expect(fileSlot("tools.RtD")).toBe("rtd");
    for (const no of ["ncd", "x.ncd.bak", "x.ncd.txt", "", "x.", "x.nc"]) expect(fileSlot(no), no).toBeNull();
  });

  it("calls a set of files a drilling or a routing job, drilling first, and none when there are no programs", () => {
    expect(kindOfFiles({ ncd: "", plt: "" })).toBe("drill");
    expect(kindOfFiles({ plt: "" })).toBe("route");
    expect(kindOfFiles({ dtd: "", rtd: "" })).toBeNull();
    expect(kindOfFiles({})).toBeNull();
  });

  it("names a job from the file without folders (of either kind) or extension, and cuts a long name", () => {
    expect(nameFromFile("C:\\jobs\\boards\\board.v2.ncd")).toBe("board.v2");
    expect(nameFromFile("/home/ana/pieza ñ.plt")).toBe("pieza ñ");
    expect(nameFromFile("no-extension")).toBe("no-extension");
    expect(nameFromFile("dir.d/file")).toBe("file");
    expect(nameFromFile(`${"a".repeat(80)}.ncd`)).toHaveLength(60);
  });

  it("asks for a sorting only for a drilling job and only when there is one", () => {
    expect(fileRequest("drill", "n", { ncd: "x" }, "").sorting).toBeUndefined();
    expect(fileRequest("drill", "n", { ncd: "x" }).sorting).toBeUndefined();
    expect(fileRequest("drill", "n", { ncd: "x" }, "tsp").sorting).toBe("tsp");
    expect(fileRequest("route", "n", { plt: "x" }, "tsp").sorting).toBeUndefined();
  });
});

describe("the plan", () => {
  it("has a box for any bounds: none, wrong ones, a point, and upside down", () => {
    const none = { x: 0, y: 0, w: 100, h: 80 };
    expect(planBox({ bounds_mm: undefined as unknown as [number, number, number, number] })).toEqual(none);
    expect(planBox({ bounds_mm: [1, 2, 3] as unknown as [number, number, number, number] })).toEqual(none);
    expect(planBox({ bounds_mm: [10, 10, 10, 10] })).toEqual({ x: 8, y: 8, w: 5, h: 5 });
    expect(planBox({ bounds_mm: [0, 0, 50, 20] }, 0)).toEqual({ x: 0, y: 0, w: 50, h: 20 });
    // upside down is still a box that holds nothing smaller than a millimetre plus the margin
    expect(planBox({ bounds_mm: [10, 10, 0, 0] }).w).toBe(5);
  });

  it("draws a hole at least 0.35 mm wide in radius and larger on a big board", () => {
    expect(holeRadius({ x: 0, y: 0, w: 10, h: 10 })).toBe(0.35);
    expect(holeRadius({ x: 0, y: 0, w: 300, h: 100 })).toBe(2);
    expect(holeRadius({ x: 0, y: 0, w: 100, h: 300 })).toBe(2);
  });

  it("counts holes finished at the item they end on, and none for no list or for a job that has not begun", () => {
    expect(holesDone({ hole_ends: undefined as unknown as number[] }, 5)).toBe(0);
    const v = { hole_ends: [3, 6, 9] };
    expect([-1, 0, 2, 3, 5, 6, 9, 100].map((n) => holesDone(v, n))).toEqual([0, 0, 0, 1, 1, 2, 3, 3]);
  });

  it("colours the tools in turn, the first for anything below 1, and the same after ten", () => {
    expect(toolColour(1)).toBe(TOOL_COLOURS[0]);
    expect(toolColour(0)).toBe(TOOL_COLOURS[0]);
    expect(toolColour(-7)).toBe(TOOL_COLOURS[0]);
    expect(toolColour(10)).toBe(TOOL_COLOURS[9]);
    expect(toolColour(11)).toBe(TOOL_COLOURS[0]);
    expect(toolColour(99)).toBe(TOOL_COLOURS[8]);
    expect(new Set(TOOL_COLOURS).size).toBe(TOOL_COLOURS.length);
  });
});

describe("the list of jobs", () => {
  it("looks for every word in some field, ignoring case, spaces and the characters a pattern would use", () => {
    const j = job({ name: "Placa (ñandú) v1.0", machine: "taller-2", by: "Ana", state: "waiting_operator" });
    expect(matchesQuery(j, "   ")).toBe(true);
    expect(matchesQuery(j, "ÑANDÚ")).toBe(true);
    expect(matchesQuery(j, "ana taller")).toBe(true);
    expect(matchesQuery(j, "ana zzz")).toBe(false);
    expect(matchesQuery(j, "wait")).toBe(true);
    expect(matchesQuery(j, "(ñ")).toBe(true);
    expect(matchesQuery(j, ".*")).toBe(false);
    expect(matchesQuery(j, "v1.0")).toBe(true);
  });

  it("sorts a copy and leaves the list as it was", () => {
    const list = [job({ id: "1", created: 5 }), job({ id: "2", created: 9 }), job({ id: "3", created: 1 })];
    const before = list.map((j) => j.id);
    expect(sortJobs(list, "newest").map((j) => j.id)).toEqual(["2", "1", "3"]);
    expect(sortJobs(list, "oldest").map((j) => j.id)).toEqual(["3", "1", "2"]);
    expect(list.map((j) => j.id)).toEqual(before);
  });

  it("puts the jobs of one machine together, the newest first, and a job with no items last, not NaN first", () => {
    const list = [
      job({ id: "a", machine: "b", created: 1 }),
      job({ id: "b", machine: "a", created: 1 }),
      job({ id: "c", machine: "b", created: 7 }),
    ];
    expect(sortJobs(list, "machine").map((j) => j.id)).toEqual(["b", "c", "a"]);
    const p = [
      job({ id: "none", items_total: 0, items_done: 0 }),
      job({ id: "half", items_total: 10, items_done: 5 }),
      job({ id: "all", items_total: 10, items_done: 10 }),
    ];
    expect(sortJobs(p, "progress").map((j) => j.id)).toEqual(["all", "half", "none"]);
  });

  it("waits for the operator in the order they began to wait, with the date of the job when it has not started", () => {
    const list = [
      job({ id: "late", state: "waiting_operator", started: 50, created: 1 }),
      job({ id: "nostart", state: "waiting_operator", started: null, created: 20 }),
      job({ id: "early", state: "waiting_operator", started: 10, created: 99 }),
      job({ id: "run", state: "running", started: 1 }),
    ];
    expect(waitingJobs(list).map((j) => j.id)).toEqual(["early", "nostart", "late"]);
  });

  it("adds up only what is done and counts a failed job but not its holes", () => {
    const list = [
      job({ state: "done", started: 10, finished: 70, holes_done: 4 }),
      job({ state: "done", started: null, finished: 70, holes_done: 6 }),
      job({ state: "failed", started: 1, finished: 9, holes_done: 3 }),
      job({ state: "cancelled", holes_done: 8 }),
      job({ state: "running", holes_done: 2 }),
    ];
    expect(totals(list)).toEqual({ done: 2, failed: 1, holes: 10, seconds: 60 });
    expect(totals([])).toEqual({ done: 0, failed: 0, holes: 0, seconds: 0 });
  });

  it("measures the time of a job only when it began, ended and did not end before it began", () => {
    expect(took({ started: 5, finished: 9 })).toBe(4);
    expect(took({ started: 5, finished: 5 })).toBe(0);
    expect(took({ started: 9, finished: 5 })).toBeNull();
    expect(took({ started: null, finished: 5 })).toBeNull();
    expect(took({ started: 5, finished: null })).toBeNull();
  });

  it("splits one machine's jobs: the first that is active, the ready ones in order, the last finished, and the time still to come", () => {
    const list = [
      job({ id: "other", machine: "m2", state: "running" }),
      job({ id: "r2", state: "ready", created: 30, estimate_s: 10 }),
      job({ id: "r1", state: "ready", created: 20, estimate_s: null }),
      job({ id: "run", state: "running", created: 5 }),
      ...[1, 2, 3, 4].map((n) => job({ id: `d${n}`, state: "done", created: n, finished: n * 10 })),
      job({ id: "x", state: "failed", created: 1, finished: null }),
    ];
    const q = machineQueue(list, "m1", 3);
    expect(q.active?.id).toBe("run");
    expect(q.ready.map((j) => j.id)).toEqual(["r1", "r2"]);
    expect(q.readySeconds).toBe(10);
    expect(q.recent.map((j) => j.id)).toEqual(["d4", "d3", "d2"]);
    expect(machineQueue([], "m1")).toEqual({ active: null, ready: [], recent: [], readySeconds: 0 });
  });
});

/** A small reader of CSV with quotes, to check that what is written is what comes back. */
function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i += 1;
    } else cell += c;
  }
  return rows;
}

describe("the CSV of the jobs", () => {
  const nasty = ['He said "hi", then left', "two\nlines", "semi;colon", "日本語 ñ", "", " leading and trailing "];

  it("gives back every name as it was, with the same number of fields in every line", () => {
    const rows = readCsv(jobsCsv(nasty.map((name, i) => job({ id: `j${i}`, name, message: name }))));
    expect(rows).toHaveLength(nasty.length + 1);
    for (const r of rows) expect(r).toHaveLength(rows[0].length);
    expect(rows.slice(1).map((r) => r[1])).toEqual(nasty);
    expect(rows.slice(1).map((r) => r[rows[0].indexOf("message")])).toEqual(nasty);
  });

  it("leaves a missing time or message empty and ends every line with CRLF", () => {
    const text = jobsCsv([job({ started: null, finished: null, message: null, estimate_s: null })]);
    const row = readCsv(text)[1];
    const head = readCsv(text)[0];
    for (const key of ["started", "finished", "estimate_s", "message"]) expect(row[head.indexOf(key)], key).toBe("");
    expect(text.endsWith("\r\n")).toBe(true);
    expect(text.split("\n").every((l, i, a) => i === a.length - 1 || l.endsWith("\r"))).toBe(true);
    expect(jobsCsv([])).toBe(head.join(",") + "\r\n");
  });

  it.skip("bug: a name that starts with = + - or @ is written as it is, and a spreadsheet runs it as a formula", () => {
    const rows = readCsv(jobsCsv([job({ name: "=HYPERLINK(\"http://x\",\"a\")" })]));
    expect(rows[1][1].startsWith("=")).toBe(false);
  });
});

describe("machines moved between servers", () => {
  const machine = (id: string, kind: string, extra: Record<string, unknown> = {}) => ({
    id,
    name: `Máquina ${id}`,
    model: "ccd-atc",
    station: "taller",
    connection: { kind, address: "10.0.0.2", ...extra },
    dcf: "d",
    rcf: "r",
    cfg: "c",
  });

  it("writes a version, never a token, and reads the three kinds of connection back", () => {
    const withToken = { ...machine("a", "node"), token: "SECRET-TOKEN" };
    const text = machineExport([withToken, machine("b", "grbl", { port: "COM7", baud: 250000 }), machine("c", "demo")] as never);
    expect(text).not.toContain("SECRET-TOKEN");
    expect(text).not.toContain("token");
    expect(JSON.parse(text).eh3d_machines).toBe(1);
    expect(text.endsWith("\n")).toBe(true);
    const back = machineImport(text)!;
    expect(back.map((m) => m.connection)).toEqual([{ kind: "node", address: "10.0.0.2" }, { kind: "grbl", port: "COM7", baud: 250000 }, { kind: "demo" }]);
    expect(back[0].name).toBe("Máquina a");
    expect(machineImport(machineExport(back as never))).toEqual(back);
  });

  it("uses the address as the port of a GRBL machine that has none, and the usual baud rate", () => {
    const back = machineImport(machineExport([machine("g", "grbl")] as never))!;
    expect(back[0].connection).toEqual({ kind: "grbl", port: "10.0.0.2", baud: 115200 });
  });

  it("refuses what is not a file of machines and fills in what a machine leaves out", () => {
    for (const bad of ["", "{", "null", "[]", "42", '"text"', '{"eh3d_machines":2,"machines":[]}', '{"eh3d_machines":1}', '{"eh3d_machines":1,"machines":{}}', '{"eh3d_machines":1,"machines":[{"name":"x"}]}', '{"eh3d_machines":1,"machines":[{"id":"x"}]}']) {
      expect(machineImport(bad), bad).toBeNull();
    }
    const m = machineImport('{"eh3d_machines":1,"machines":[{"id":"x","name":"X","connection":{"kind":"warp","port":5,"baud":"fast"},"dcf":7}]}')!;
    expect(m[0]).toEqual({ id: "x", name: "X", model: "ccd-mtc", station: "", connection: { kind: "demo" }, dcf: "", rcf: "", cfg: "" });
    const g = machineImport('{"eh3d_machines":1,"machines":[{"id":"g","name":"G","connection":{"kind":"grbl","port":5,"baud":"fast"}}]}')!;
    expect(g[0].connection).toEqual({ kind: "grbl", port: "", baud: 115200 });
    expect(machineImport('{"eh3d_machines":1,"machines":[]}')).toEqual([]);
  });

  it("finds an id for a copy that is free, never longer than 32 characters", () => {
    expect(copyId("bungard", [])).toBe("bungard-2");
    expect(copyId("bungard", ["bungard-2", "bungard-3"])).toBe("bungard-4");
    expect(copyId("bungard-7", ["bungard-2"])).toBe("bungard-3");
    const long = "m".repeat(40);
    const c = copyId(long, []);
    expect(c).toHaveLength(32);
    expect(c.endsWith("-2")).toBe(true);
    const taken = Array.from({ length: 998 }, (_, i) => `x-${i + 2}`);
    expect(copyId("x", taken)).toBe("x-copy");
    expect(copyId("x", ["x"])).toBe("x-2");
  });

  it("names the copies of a job in order, from 1 to 50, and keeps every name within 60 characters", () => {
    expect(copyNames("board", 1)).toEqual(["board"]);
    expect(copyNames("board", 3)).toEqual(["board", "board #2", "board #3"]);
    for (const n of [0, -4, NaN, NaN]) expect(copyNames("board", n)).toEqual(["board"]);
    expect(copyNames("board", 2.9)).toHaveLength(2);
    expect(copyNames("board", 500)).toHaveLength(50);
    const names = copyNames("x".repeat(60), 50);
    expect(names.every((n) => n.length <= 60)).toBe(true);
    expect(new Set(names).size).toBe(50);
  });
});
