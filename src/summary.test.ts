import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { LANGS, errorText, text } from "./i18n";
import type { TextKey } from "./i18n";
import { CONFIRM_KEY, confirmStartOn, reachLine, startSummary, warningKey, warningVars } from "./model";
import { ROWS } from "./texts";
import type { DryRunView, JobView, WorkWarning } from "./types";

const DRY: DryRunView = { min_mm: [0, 0, 0], max_mm: [120.04, 80, 12.5], end_mm: [0, 0, 0], steps: 1000, seconds: 125, within_course: true };

function view(over: Partial<JobView> = {}): JobView {
  return {
    kind: "drill",
    name: "board",
    tools: [{ number: 1, spindle_rpm: 24000, count: 2, feed_mm_min: 900, depth_mm: null, iterations: null }],
    holes: [
      { tool: 1, x_mm: 10, y_mm: 10 },
      { tool: 1, x_mm: 30, y_mm: 25.5 },
    ],
    paths: [],
    bounds_mm: [10, 10, 30, 25.5],
    items: 40,
    hole_ends: [],
    estimate_s: 60,
    travel_mm: 20,
    ...over,
  };
}

describe("the summary before a job starts", () => {
  it("counts the work, rounds its size and takes the time from the dry run when there is one", () => {
    const s = startSummary(view({ dry_run: DRY }));
    expect(s.count).toBe(2);
    expect(s.tools).toBe(1);
    expect(s.sizeMm).toEqual([20, 15.5]);
    expect(s.seconds).toBe(125);
    expect(s.outOfCourse).toBe(false);
    expect(startSummary(view()).seconds).toBe(60);
    expect(startSummary(view({ kind: "route", holes: [], paths: [{ points_mm: [[0, 0]] }] })).count).toBe(1);
  });

  it("says a plan that goes past the course and writes the reach of the axes", () => {
    const s = startSummary(view({ dry_run: { ...DRY, within_course: false } }));
    expect(s.outOfCourse).toBe(true);
    expect(reachLine(DRY)).toBe("X 0.0..120.0   Y 0.0..80.0   Z 0.0..12.5");
  });

  it("gives every warning the server can send a text with its numbers in every language", () => {
    const all: WorkWarning[] = [
      { code: "tiny", values: [3.04, 2] },
      { code: "too_big", values: [600, 40, 555, 405] },
      { code: "far", values: [300.26] },
      { code: "scale", values: [1, 0.5] },
      { code: "out_of_course", axis: "Y", values: [4.44] },
    ];
    for (const w of all) {
      const key = warningKey(w.code);
      expect(ROWS, w.code).toHaveProperty(key);
      for (const lang of LANGS) {
        const line = text(lang, key as TextKey, warningVars(w));
        expect(line, `${key}/${lang}`).not.toContain("{");
        expect(line, `${key}/${lang}`).toMatch(/\d/);
      }
    }
    expect(warningVars(all[0])).toEqual({ w: 3, h: 2 });
    expect(warningVars(all[4])).toEqual({ axis: "Y", mm: 4.4 });
    const s = startSummary(view({ warnings: all }));
    expect(s.warnings.map((w) => w.key)).toEqual(["warn_tiny", "warn_too_big", "warn_far", "warn_scale", "warn_out_of_course"]);
  });

  it("has every text of the summary in the eight languages and the refusal of a plan outside the course", () => {
    for (const k of ["sum_title", "sum_count", "sum_size", "sum_time", "sum_reach", "sum_dry_ok", "sum_dry_bad", "sum_start", "sum_cancel", "sum_loading", "pref_confirm_start", "pref_confirm_start_hint"] as const) {
      expect(ROWS, k).toHaveProperty(k);
    }
    for (const lang of LANGS) {
      expect(errorText(lang, new ApiError(422, "outside_course", "axis X 3.0 mm"))).toContain("(axis X 3.0 mm)");
      expect(errorText(lang, new ApiError(422, "outside_course", ""))).not.toContain("outside_course");
      expect(text(lang, "sum_count", { n: 4, tools: 2 })).toMatch(/4.*2/);
    }
  });

  it("is on unless the person turned it off, and still on when the browser keeps nothing", () => {
    const store = (v: string | null) => ({ getItem: (k: string) => (k === CONFIRM_KEY ? v : null) });
    expect(confirmStartOn(store(null))).toBe(true);
    expect(confirmStartOn(store("1"))).toBe(true);
    expect(confirmStartOn(store("0"))).toBe(false);
    expect(confirmStartOn(null)).toBe(true);
    expect(
      confirmStartOn({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(true);
  });
});
