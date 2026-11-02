/* What the server answers, as the tests of the server make it (src/examples/*.json, copied from EH3D-SERVER/tests/examples): the client reads every example through
 * its own API class and the functions that the pages use, and the fields it relies on must be there with the type it expects. A change in the answers of the server that
 * this client does not follow fails here instead of in front of a person. GPL-3.0-or-later. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Api, ApiError } from "./api";
import { errorText } from "./i18n";
import { groupFleet, studioReplaced, splitStep, undoable, updatable, updatesBusy } from "./model";
import { JOB_KINDS, JOB_STATES } from "./types";
import type { Fleet, Health, Job, JobSummary, JobView, Session, SpindleView, UpdatesView } from "./types";

function example(name: string): unknown {
  return JSON.parse(readFileSync(new URL(`./examples/${name}.json`, import.meta.url), "utf8"));
}

/** A client whose server answers with the example. */
function clientFor(name: string, status = 200) {
  const fetcher = async () => new Response(JSON.stringify(example(name)), { status });
  return new Api("tok", fetcher);
}

type Kind = "string" | "number" | "boolean" | "array" | "object" | "string|null" | "number|null" | "object|null";

/** Fails when a field is missing or is not of the kind the client relies on. */
function shape(value: unknown, fields: Record<string, Kind>, where: string): void {
  expect(value, where).toBeTypeOf("object");
  const record = value as Record<string, unknown>;
  for (const [key, kind] of Object.entries(fields)) {
    const got = record[key];
    const ok = kind.split("|").some((k) => {
      if (k === "null") return got === null;
      if (k === "array") return Array.isArray(got);
      if (k === "object") return typeof got === "object" && got !== null && !Array.isArray(got);
      return typeof got === k;
    });
    expect(ok, `${where}.${key} should be ${kind}, is ${JSON.stringify(got)}`).toBe(true);
  }
}

const SUMMARY: Record<string, Kind> = {
  id: "string",
  machine: "string",
  name: "string",
  kind: "string",
  state: "string",
  created: "number",
  started: "number|null",
  finished: "number|null",
  by: "string",
  items_total: "number",
  items_done: "number",
  holes_total: "number",
  holes_done: "number",
  message: "string|null",
  pause: "object|null",
  estimate_s: "number|null",
};

const VIEW: Record<string, Kind> = {
  kind: "string",
  name: "string",
  tools: "array",
  holes: "array",
  paths: "array",
  bounds_mm: "array|null" as Kind,
  items: "number",
  hole_ends: "array",
  estimate_s: "number|null",
  travel_mm: "number|null",
  spindle_warnings: "array",
  dry_run: "object|null",
  warnings: "array",
};

function checkView(view: JobView, where: string): void {
  shape(view, { ...VIEW, travel_mm: "number|null" }, where);
  expect(JOB_KINDS).toContain(view.kind);
  expect(view.tools.length).toBeGreaterThan(0);
  for (const tool of view.tools) shape(tool, { number: "number", spindle_rpm: "number|null", count: "number", feed_mm_min: "number|null", depth_mm: "number|null", iterations: "number|null" }, `${where}.tools`);
  for (const hole of view.holes) shape(hole, { tool: "number", x_mm: "number", y_mm: "number" }, `${where}.holes`);
  if (view.dry_run) {
    shape(view.dry_run, { min_mm: "array", max_mm: "array", end_mm: "array", steps: "number", seconds: "number", within_course: "boolean" }, `${where}.dry_run`);
    expect(view.dry_run.max_mm).toHaveLength(3);
  }
}

describe("the answers of the server, from its own examples", () => {
  it("the health and the session", async () => {
    const health: Health = await clientFor("health").health();
    shape(health, { name: "string", version: "string" }, "health");
    const session: Session = await clientFor("session").session();
    shape(session, { name: "string", role: "string", is_token: "boolean" }, "session");
    expect(["viewer", "operator", "admin"]).toContain(session.role);
  });

  it("the fleet, with the stations and the machines under them", async () => {
    const fleet: Fleet = await clientFor("fleet").fleet();
    shape(fleet, { stations: "array", machines: "array" }, "fleet");
    expect(fleet.machines.length).toBeGreaterThan(1);
    for (const m of fleet.machines) {
      shape(m, { id: "string", name: "string", model: "string", station: "string", connection: "string", state: "string", job: "object|null", ready: "number" }, "fleet.machines");
      expect(["idle", "busy", "waiting"]).toContain(m.state);
    }
    const groups = groupFleet(fleet);
    expect(groups.flatMap((g) => g.machines.map((m) => m.id)).sort()).toEqual(fleet.machines.map((m) => m.id).sort());
  });

  it("the list of the jobs and one job with its view", async () => {
    const jobs: JobSummary[] = await clientFor("jobs").jobs();
    expect(jobs.length).toBeGreaterThan(0);
    for (const j of jobs) {
      shape(j, SUMMARY, "jobs");
      expect(JOB_STATES).toContain(j.state);
      expect(JOB_KINDS).toContain(j.kind);
    }
    const job: Job = await clientFor("job").job("any");
    shape(job, SUMMARY, "job");
    expect(job.view).not.toBeNull();
    checkView(job.view as JobView, "job.view");
    // the list and the job say the same about the same job
    expect(jobs[0]!.id).toBe(job.id);
    expect(jobs[0]!.holes_total).toBe(job.holes_total);
  });

  it("the preview of a job, which is the view that the job carries", async () => {
    const view = await clientFor("preview").previewJob("m1", {});
    checkView(view, "preview");
    const job = example("job") as { view: JobView };
    expect(view.holes).toEqual(job.view.holes);
    expect(view.items).toBe(job.view.items);
  });

  it("the spindle of a machine", async () => {
    const spindle: SpindleView = await clientFor("spindle").spindle("m1");
    shape(spindle, { spindle: "string", guard: "string", limits: "object", active: "object|null", node_max_rpm: "number|null" }, "spindle");
    for (const id of ["original", "vfd"] as const) {
      shape(spindle.limits[id], { min_rpm: "number", max_rpm: "number", power_w: "number", max_xy_mm_min: "number", max_z_mm_min: "number", max_bit_mm: "number" }, `spindle.limits.${id}`);
    }
    expect(["reject", "warn"]).toContain(spindle.guard);
  });

  it("a refusal carries a code and a detail, and the code is told in the eight languages or shown as it is", async () => {
    const api = clientFor("error", 422);
    const failure = await api.previewJob("m1", {}).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    const raw = example("error") as { error: string; detail: string };
    expect((failure as ApiError).code).toBe(raw.error);
    expect((failure as ApiError).detail).toBe(raw.detail);
    expect(errorText("en", failure).length).toBeGreaterThan(0);
  });

  it("the updates, with the version an update left behind", async () => {
    const view: UpdatesView = await clientFor("updates").updates();
    shape(view, { enabled: "boolean", pending: "boolean", state: "string", message: "string", log: "array", percent: "number", steps: "array", history: "array", components: "array" }, "updates");
    for (const c of view.components) {
      shape(c, { id: "string", name: "string", installed: "string|null", latest: "string|null", newer: "boolean", url: "string|null", published: "string|null", notes: "string", previous: "string|null", can_undo: "boolean" }, "updates.components");
    }
    for (const st of view.steps ?? []) {
      shape(st, { id: "string", state: "string", percent: "number" }, "updates.steps");
      expect(splitStep(st.id).component).not.toBe("");
    }
    for (const h of view.history ?? []) shape(h, { id: "string", started: "number", kind: "string", label: "string", state: "string" }, "updates.history");
    expect(updatable(view)).toEqual(["server", "studio"]);
    expect(undoable(view)).toEqual(["studio"]);
    expect(updatesBusy(view)).toBe(false);
    expect(studioReplaced(view)).toBe(true);
  });
});
