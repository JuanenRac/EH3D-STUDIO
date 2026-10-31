import { describe, expect, it } from "vitest";
import { Api, ApiError } from "./api";
import { LANGS, browserLang, errorText, text } from "./i18n";
import type { TextKey } from "./i18n";
import {
  PAGES,
  atLeast,
  cfgKeys,
  countJobs,
  duration,
  emptyMachine,
  groupFleet,
  connectionBody,
  jobActions,
  jobKindKey,
  jobPercent,
  pauseKey,
  resumeLine,
  takesJob,
  validBaud,
  validPort,
  machineProblems,
  pagesFor,
  spindleFindingKey,
  spindleNameKey,
  toInput,
  updatable,
  updatesBusy,
  validAddress,
  validName,
  validPassword,
} from "./model";
import { ROWS } from "./texts";
import type { Fleet, JobSummary, Machine } from "./types";
import { describeEvent, stateKey } from "./pages/Monitor";
import { SERVER_SETTINGS } from "./pages/Configure";

/** A fetch that answers from a list and remembers what it was asked. */
function fakeFetch(answers: { status: number; body?: unknown }[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const a = answers.shift() ?? { status: 500 };
    return new Response(a.body === undefined ? "" : JSON.stringify(a.body), { status: a.status });
  };
  return { fetcher, calls };
}

describe("the client of the API", () => {
  it("sends the token, the body and the query, and reads the answer", async () => {
    const f = fakeFetch([{ status: 200, body: [{ id: "j1" }] }, { status: 200, body: { token: "tok", name: "ana", role: "admin", expires_s: 10 } }]);
    const api = new Api("abc", f.fetcher);
    await api.jobs({ machine: "m 1", state: "running" });
    expect(f.calls[0].url).toBe("/api/v1/jobs?machine=m+1&state=running");
    expect((f.calls[0].init?.headers as Record<string, string>).authorization).toBe("Bearer abc");
    const login = await api.login("ana", "a-long-password");
    expect(login.role).toBe("admin");
    expect(api.token).toBe("tok");
    expect(f.calls[1].init?.body).toBe(JSON.stringify({ name: "ana", password: "a-long-password" }));
  });

  it("turns a refusal into one kind of error", async () => {
    const f = fakeFetch([{ status: 409, body: { error: "machine_busy", detail: "a job runs" } }, { status: 502 }]);
    const api = new Api(null, f.fetcher);
    await expect(api.deleteMachine("m1")).rejects.toMatchObject({ status: 409, code: "machine_busy", detail: "a job runs" });
    await expect(api.fleet()).rejects.toMatchObject({ status: 502, code: "http_502" });
  });

  it("says unreachable when the network fails and keeps no token after a sign-out", async () => {
    const api = new Api("t", async () => {
      throw new Error("down");
    });
    await expect(api.health()).rejects.toMatchObject({ code: "unreachable", status: 0 });
    await expect(api.logout()).rejects.toBeInstanceOf(ApiError);
    expect(api.token).toBeNull();
  });

  it("puts the token in the address of the websocket and escapes the names in the paths", () => {
    const api = new Api("a b");
    expect(api.eventsUrl({ protocol: "http:", host: "cm5:18200" })).toBe("ws://cm5:18200/api/v1/events?token=a%20b");
    expect(api.eventsUrl({ protocol: "https:", host: "x" }).startsWith("wss://")).toBe(true);
  });

  it("encodes the names of users and machines", async () => {
    const f = fakeFetch([{ status: 200, body: {} }]);
    await new Api("t", f.fetcher).deleteUser("a/b");
    expect(f.calls[0].url).toBe("/api/v1/users/a%2Fb");
  });
});

describe("the rules checked before a request goes out", () => {
  it("accepts the names and passwords the server accepts", () => {
    for (const ok of ["a", "bench-1", "A_b.c", "x".repeat(32)]) expect(validName(ok)).toBe(true);
    for (const bad of ["", "a b", "a/b", "ñ", "x".repeat(33)]) expect(validName(bad)).toBe(false);
    expect(validPassword("12345678")).toBe(true);
    expect(validPassword("1234567")).toBe(false);
    expect(validPassword("x".repeat(129))).toBe(false);
    expect(validPassword("ñ".repeat(8))).toBe(true);
  });

  it("reads the address of a node", () => {
    expect(validAddress("192.168.0.50:5800")).toBe(true);
    expect(validAddress("node.local:80")).toBe(true);
    for (const bad of ["192.168.0.50", "host:0", "host:65536", ":5800", "a b:80", "host:port"]) expect(validAddress(bad)).toBe(false);
  });

  it("names what is wrong with a machine", () => {
    const m = emptyMachine();
    expect(machineProblems(m).sort()).toEqual(["id", "name"]);
    m.id = "bench-1";
    m.name = "Bungard 1";
    expect(machineProblems(m)).toEqual([]);
    m.station = "no good";
    m.connection = { kind: "node", address: "nope" };
    expect(machineProblems(m).sort()).toEqual(["address", "station"]);
    m.station = "bench";
    m.connection = { kind: "node", address: "192.168.0.50:5800" };
    expect(machineProblems(m)).toEqual([]);
  });

  it("starts a form from a machine without showing its token", () => {
    const m: Machine = { id: "m", name: "M", model: "ccd-mtc", station: "", connection: { kind: "node", address: "h:1", token_set: true }, dcf: "d", rcf: "r", cfg: "a = 1" };
    const i = toInput(m);
    expect(i.connection.token).toBe("");
    expect(i.connection.address).toBe("h:1");
    expect(cfgKeys("# c\n a = 1 \n\nb=2\n; x\nnokey\n")).toEqual(["a", "b"]);
  });
});

describe("the navigation", () => {
  it("shows each role the pages it may use, in three groups", () => {
    expect(pagesFor("viewer").map((p) => p.id)).toEqual(["overview", "fleet", "machine", "jobs", "job", "live", "server", "account", "preferences", "about"]);
    expect(pagesFor("operator").length).toBe(pagesFor("viewer").length + 1);
    expect(pagesFor("admin").length).toBe(PAGES.length);
    expect(new Set(PAGES.map((p) => p.group))).toEqual(new Set(["monitor", "configure", "account"]));
    expect(atLeast("operator", "viewer") && !atLeast("viewer", "operator") && atLeast("admin", "admin")).toBe(true);
  });
});

describe("the fleet and the jobs", () => {
  const fleet: Fleet = {
    stations: [
      { id: "room", machines: ["r1"] },
      { id: "bench", machines: ["b2", "b1", "gone"] },
      { id: "", machines: ["loose"] },
    ],
    machines: ["b1", "b2", "r1", "loose", "extra"].map((id) => ({ id, name: id, model: "m", station: "", connection: "demo", state: "idle" as const, job: null, ready: 0 })),
    summary: { machines: 5, idle: 5, busy: 0, waiting: 0, stations: 3 },
  };

  it("groups the machines under their stations and leaves the ones without a station last", () => {
    const g = groupFleet(fleet);
    expect(g.map((x) => x.station)).toEqual(["room", "bench", ""]);
    expect(g[1].machines.map((m) => m.id)).toEqual(["b2", "b1"]);
    expect(g[2].machines.map((m) => m.id)).toEqual(["loose", "extra"]);
  });

  const job = (state: JobSummary["state"], done = 0, total = 0): JobSummary =>
    ({ id: "j", machine: "m", name: "n", kind: "drill", state, created: 0, started: null, finished: null, by: "x", items_total: total, items_done: done, holes_total: 0, holes_done: 0, message: null, pause: null, estimate_s: null });

  it("counts jobs by state and gives their progress", () => {
    const c = countJobs([job("ready"), job("running"), job("running"), job("failed")]);
    expect([c.ready, c.running, c.failed, c.done]).toEqual([1, 2, 1, 0]);
    expect(jobPercent(job("running", 1, 4))).toBe(25);
    expect(jobPercent(job("running", 9, 4))).toBe(100);
    expect(jobPercent(job("running", 0, 0))).toBe(0);
    expect(jobPercent(job("done", 0, 0))).toBe(100);
  });

  it("offers a person only what their role and the state of the job allow", () => {
    expect(jobActions(job("ready"), "operator")).toEqual({ start: true, confirm: false, pause: false, resume: false, cancel: true, remove: true });
    expect(jobActions(job("waiting_operator"), "operator")).toEqual({ start: false, confirm: true, pause: false, resume: false, cancel: true, remove: false });
    expect(jobActions(job("done"), "admin")).toEqual({ start: false, confirm: false, pause: false, resume: false, cancel: false, remove: true });
    expect(jobActions(job("ready"), "viewer")).toEqual({ start: false, confirm: false, pause: false, resume: false, cancel: false, remove: false });
  });

  it("writes a duration", () => {
    expect([duration(45), duration(200), duration(3900), duration(null), duration(-1)]).toEqual(["45 s", "3 min 20 s", "1 h 05 min", "-", "-"]);
  });

  it("describes an event of the server in one line", () => {
    expect(describeEvent(JSON.stringify({ type: "hello", jobs: [1, 2] }))).toBe("hello · 2 jobs");
    expect(describeEvent(JSON.stringify({ type: "job", job: { name: "b", machine: "m1", state: "running", items_done: 2, items_total: 9 } }))).toBe("b · m1 · running · 2/9");
    expect(describeEvent("not json")).toBe("not json");
    expect(describeEvent("x".repeat(300)).length).toBeLessThanOrEqual(200);
  });
});

describe("the eight languages", () => {
  const keys = Object.keys(ROWS) as TextKey[];

  it("has eight texts in every row, none empty", () => {
    for (const k of keys) {
      const row = ROWS[k] as readonly string[];
      expect(row.length, k).toBe(LANGS.length);
      row.forEach((s, i) => expect(s.trim().length, `${k}/${LANGS[i]}`).toBeGreaterThan(0));
    }
  });

  it("writes Chinese and Japanese in their own scripts and does not repeat English for most languages", () => {
    const cjk = /[぀-ヿ㐀-鿿]/;
    for (const k of keys) {
      const row = ROWS[k] as readonly string[];
      expect(cjk.test(row[6]), `${k}/zh`).toBe(true);
      expect(cjk.test(row[7]), `${k}/ja`).toBe(true);
    }
    // a few words are the same in several languages (Server, Neon...); no row may be English in more than half of the others
    for (const k of keys) {
      const row = ROWS[k] as readonly string[];
      expect(row.slice(1).filter((s) => s === row[0]).length, k).toBeLessThanOrEqual(5);
    }
  });

  it("keeps the placeholders of every language the same", () => {
    for (const k of keys) {
      const row = ROWS[k] as readonly string[];
      const holes = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join();
      row.forEach((s, i) => expect(holes(s), `${k}/${LANGS[i]}`).toBe(holes(row[0])));
    }
  });

  it("has a text for every page, state, role, theme, refusal and setting the pages name", () => {
    for (const p of PAGES) expect(ROWS, p.id).toHaveProperty(`nav_${p.id}`);
    for (const g of ["monitor", "configure", "account"]) expect(ROWS).toHaveProperty(`group_${g}`);
    for (const s of ["ready", "connecting", "running", "waiting_operator", "done", "cancelled", "failed"] as const) expect(ROWS).toHaveProperty(stateKey(s));
    for (const r of ["viewer", "operator", "admin"]) expect(ROWS).toHaveProperty(`role_${r}`);
    for (const s of SERVER_SETTINGS) expect(ROWS).toHaveProperty(s.text);
  });

  it("fills the values in, picks the language of the browser and says a refusal in the language of the person", () => {
    expect(text("de", "fleet_ready", { n: 3 })).toBe("3 Aufträge bereit");
    expect(browserLang(["xx", "pt-PT", "en"])).toBe("pt");
    expect(browserLang(["fr-CA"])).toBe("fr");
    expect(browserLang(["ko"])).toBe("en");
    expect(errorText("es", new ApiError(409, "machine_busy", ""))).toBe(text("es", "err_machine_busy"));
    expect(errorText("en", new ApiError(400, "weird_code", "why"))).toBe("weird_code: why");
    expect(errorText("it", new ApiError(0, "unreachable", "down"))).toBe(text("it", "err_unreachable"));
  });
});

describe("the updates", () => {
  const view = (patch: Record<string, unknown> = {}) => ({
    enabled: true,
    pending: false,
    state: "idle",
    message: "",
    log: [],
    components: [
      { id: "server", name: "EH3D-SERVER", installed: "0.0.1", latest: "0.0.2", newer: true, url: null, published: null },
      { id: "studio", name: "EH3D-STUDIO", installed: "0.0.1", latest: "0.0.1", newer: false, url: null, published: null },
    ],
    ...patch,
  });

  it("only an administrator sees the page, and it is in the group Configure", () => {
    const page = PAGES.find((p) => p.id === "updates");
    expect(page).toEqual({ id: "updates", group: "configure", needs: "admin" });
    expect(pagesFor("operator").some((p) => p.id === "updates")).toBe(false);
    expect(pagesFor("admin").some((p) => p.id === "updates")).toBe(true);
  });

  it("offers the components that have a newer release and waits while the helper works", () => {
    expect(updatable(view())).toEqual(["server"]);
    expect(updatable(view({ components: [] }))).toEqual([]);
    expect(updatesBusy(view())).toBe(false);
    expect(updatesBusy(view({ pending: true }))).toBe(true);
    expect(updatesBusy(view({ state: "checking" }))).toBe(true);
    expect(updatesBusy(view({ state: "updating" }))).toBe(true);
    expect(updatesBusy(view({ state: "done" }))).toBe(false);
    expect(updatesBusy(view({ state: "error" }))).toBe(false);
  });

  it("asks the server for them, checks them and updates them", async () => {
    const f = fakeFetch([{ status: 200, body: view() }, { status: 200, body: { ok: true } }, { status: 200, body: { ok: true } }, { status: 409, body: { error: "update_refused", detail: "an update is already waiting or running" } }]);
    const api = new Api("tok", f.fetcher);
    expect((await api.updates()).components.length).toBe(2);
    await api.checkUpdates();
    await api.applyUpdates(["server", "studio"]);
    await expect(api.applyUpdates(["server"])).rejects.toBeInstanceOf(ApiError);
    expect(f.calls.map((c) => `${c.init?.method} ${c.url}`)).toEqual(["GET /api/v1/updates", "POST /api/v1/updates/check", "POST /api/v1/updates/apply", "POST /api/v1/updates/apply"]);
    expect(JSON.parse(String(f.calls[2].init?.body))).toEqual({ components: ["server", "studio"] });
  });

  it("has every text of the page in the eight languages", () => {
    for (const key of Object.keys(ROWS).filter((k) => k.startsWith("up_") || k === "nav_updates")) {
      for (const lang of LANGS) expect(text(lang, key as TextKey, { n: 2 }).length).toBeGreaterThan(0);
    }
    expect(text("de", "up_apply", { n: 2 })).toBe("2 aktualisieren");
    expect(text("en", "up_apply", { n: 1 })).toBe("Update 1");
  });
});

describe("the spindle of the machine", () => {
  it("reads and changes the spindle of a machine through its own address", async () => {
    const f = fakeFetch([
      { status: 200, body: { spindle: "vfd", guard: "reject", limits: {}, active: null, node_max_rpm: 24000 } },
      { status: 200, body: { spindle: "original", guard: "warn", limits: {}, active: null, node_max_rpm: 60000 } },
    ]);
    const api = new Api("t", f.fetcher);
    expect((await api.spindle("bungard 1")).node_max_rpm).toBe(24000);
    await api.setSpindle("bungard 1", { spindle: "original", guard: "warn" });
    expect(f.calls[0].url).toBe("/api/v1/machines/bungard%201/spindle");
    expect(f.calls[1].init?.method).toBe("PUT");
    expect(JSON.parse(String(f.calls[1].init?.body))).toEqual({ spindle: "original", guard: "warn" });
  });

  it("says every excess the server can find and the refusals in every language", () => {
    for (const code of ["rpm_above_max", "rpm_below_min", "feed_xy_above_max", "feed_z_above_max"] as const) {
      const key = spindleFindingKey(code);
      expect(ROWS, code).toHaveProperty(key);
      for (const lang of LANGS) {
        const line = text(lang, key as TextKey, { tool: 3, value: 60000, limit: 24000 });
        expect(line, `${key}/${lang}`).toContain("3");
        expect(line, `${key}/${lang}`).toContain("24000");
        expect(line, `${key}/${lang}`).not.toContain("{");
      }
    }
    for (const lang of LANGS) {
      expect(errorText(lang, new ApiError(422, "spindle_limit", "tool 1: ..."))).toContain("(tool 1: ...)");
      expect(errorText(lang, new ApiError(422, "bad_spindle", ""))).not.toContain("bad_spindle");
    }
  });

  it("names the spindles and the case of a machine that does not say which it carries", () => {
    expect(spindleNameKey("")).toBe("spindle_unset");
    expect(spindleNameKey("original")).toBe("spindle_original");
    expect(spindleNameKey("vfd")).toBe("spindle_vfd");
    expect(text("es", "spindle_limits_line", { min: 6000, max: 24000, xy: 1500, z: 1200, bit: 6 })).toBe("6000 a 24000 rpm · avance de corte 1500 mm/min · penetración 1200 mm/min · broca hasta 6 mm");
  });
});

describe("free G-code jobs, the GRBL connection, hold and resume", () => {
  const gcode = (state: JobSummary["state"], pause: JobSummary["pause"] = null, line = 0) =>
    ({ kind: "gcode" as const, state, pause, line });

  it("holds a running G-code job and lets a held one go on with Resume instead of Confirm", () => {
    expect(jobActions(gcode("running"), "operator")).toMatchObject({ pause: true, resume: false, confirm: false, cancel: true });
    expect(jobActions(gcode("waiting_operator", { kind: "hold" }), "operator")).toMatchObject({ pause: false, resume: true, confirm: false });
    expect(jobActions(gcode("waiting_operator", { kind: "resume" }), "operator")).toMatchObject({ resume: true, confirm: false });
    expect(jobActions(gcode("running"), "viewer")).toMatchObject({ pause: false, resume: false, cancel: false });
    // a drilling job waiting for a tool is still answered with Confirm, and cannot be held
    expect(jobActions({ kind: "drill", state: "waiting_operator", pause: { kind: "tool_change", tool: 2 } }, "operator")).toMatchObject({ confirm: true, resume: false });
    expect(jobActions({ kind: "drill", state: "running", pause: null }, "operator").pause).toBe(false);
  });

  it("names what a job waits for and what kind it is", () => {
    expect(pauseKey({ kind: "tool_change", tool: 3 })).toBe("pause_tool_change");
    expect(pauseKey({ kind: "spindle_start" })).toBe("pause_spindle_start");
    expect(pauseKey({ kind: "hold" })).toBe("pause_hold");
    expect(pauseKey({ kind: "resume" })).toBe("pause_resume");
    expect(pauseKey(null)).toBe("pause_other");
    expect(jobKindKey("gcode")).toBe("jobs_gcode");
    expect(jobKindKey("route")).toBe("jobs_route");
    expect(jobKindKey("drill")).toBe("jobs_drill");
    expect(text("es", "pause_tool_change", { tool: 3 })).toContain("3");
  });

  it("offers to go on from the line where a G-code job stopped, and only then", () => {
    expect(resumeLine({ kind: "gcode", state: "failed", line: 120 })).toBe(120);
    expect(resumeLine({ kind: "gcode", state: "cancelled", line: 7 })).toBe(7);
    expect(resumeLine({ kind: "gcode", state: "failed", line: 0 })).toBeNull();
    expect(resumeLine({ kind: "gcode", state: "done", line: 50 })).toBeNull();
    expect(resumeLine({ kind: "drill", state: "failed", line: 50 })).toBeNull();
  });

  it("asks the server to hold and to resume through the address of the job", async () => {
    const f = fakeFetch([{ status: 200, body: {} }, { status: 200, body: {} }]);
    const api = new Api("t", f.fetcher);
    await api.pauseJob("a b");
    await api.resumeJob("a b");
    expect(f.calls.map((c) => c.url)).toEqual(["/api/v1/jobs/a%20b/pause", "/api/v1/jobs/a%20b/resume"]);
    expect(f.calls.every((c) => c.init?.method === "POST")).toBe(true);
  });

  it("checks the port and the baud rate of a GRBL machine as the server does", () => {
    expect(validPort("/dev/ttyUSB0")).toBe(true);
    expect(validPort("COM3")).toBe(true);
    expect(validPort("")).toBe(false);
    expect(validPort("COM 3")).toBe(false);
    expect(validPort("a@b")).toBe(false);
    expect([validBaud(1200), validBaud(115200), validBaud(2_000_000), validBaud(1199), validBaud(2_000_001), validBaud(9600.5)]).toEqual([true, true, true, false, false, false]);
    const m = { ...emptyMachine(), id: "g1", name: "Router", connection: { kind: "grbl" as const, port: "COM3", baud: 115200 } };
    expect(machineProblems(m)).toEqual([]);
    expect(machineProblems({ ...m, connection: { kind: "grbl", port: "", baud: 100 } })).toEqual(["port", "baud"]);
    // a GRBL machine without a baud rate takes the default one
    expect(machineProblems({ ...m, connection: { kind: "grbl", port: "COM3" } })).toEqual([]);
  });

  it("sends the connection the way the server wants it, and reads a GRBL machine back into the form", () => {
    expect(connectionBody({ kind: "demo", address: "x" })).toEqual({ kind: "demo" });
    expect(connectionBody({ kind: "grbl", port: " COM3 " })).toEqual({ kind: "grbl", port: "COM3", baud: 115200 });
    expect(connectionBody({ kind: "node", address: "10.0.0.5:5800", token: "" })).toEqual({ kind: "node", address: "10.0.0.5:5800", token: "" });
    const shown: Machine = { id: "g1", name: "Router", model: "ccd-mtc", station: "", connection: { kind: "grbl", address: "COM3", token_set: false, port: "COM3", baud: 57600 }, dcf: "", rcf: "", cfg: "" };
    expect(toInput(shown).connection).toEqual({ kind: "grbl", port: "COM3", baud: 57600 });
  });

  it("knows which kinds of job each connection takes", () => {
    expect([takesJob("node", "drill"), takesJob("node", "route"), takesJob("node", "gcode")]).toEqual([true, true, false]);
    expect([takesJob("grbl", "drill"), takesJob("grbl", "route"), takesJob("grbl", "gcode")]).toEqual([false, false, true]);
    expect([takesJob("demo", "drill"), takesJob("demo", "route"), takesJob("demo", "gcode")]).toEqual([true, true, true]);
  });

  it("tells the refusals of the G-code jobs and the new settings in every language", () => {
    for (const code of ["bad_gcode", "wrong_machine", "not_pausable", "not_in_state", "no_work", "too_big", "bad_light"]) {
      for (const lang of LANGS) expect(errorText(lang, new ApiError(422, code, "")), `${code}/${lang}`).not.toContain(code);
    }
    expect(SERVER_SETTINGS.map((s) => s.key)).toEqual(expect.arrayContaining(["gcode_finish_wait_s", "updates_dir"]));
    for (const s of SERVER_SETTINGS) expect(ROWS, s.key).toHaveProperty(s.text);
  });

  it("reads and changes the ring of LEDs of the head through the server", async () => {
    const f = fakeFetch([{ status: 200, body: { on: true, level: 40 } }, { status: 200, body: { on: false, level: 40 } }, { status: 404, body: { error: "no_inspection", detail: "" } }]);
    const api = new Api("t", f.fetcher);
    expect((await api.headLight("m 1")).level).toBe(40);
    await api.setHeadLight("m 1", { on: false, level: 140, tone: "warm" });
    expect(f.calls[1].url).toBe("/api/v1/machines/m%201/head/light?on=0&level=100&tone=warm");
    await expect(api.headInspection("m 1")).rejects.toMatchObject({ code: "no_inspection" });
  });
});
