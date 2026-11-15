// @vitest-environment jsdom
/* The parts every page is built from, the drawing of a job and the summary before a job starts, drawn in a small DOM: what each one shows, what a touch does, and what it leaves alone.
 * The rules under them (the box of the drawing, the two steps of a button, the summary of a view) are tested in the other files. */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Api } from "./api";
import { PlanDownload, PlanView } from "./components/PlanView";
import { StartJobButton, SummaryFacts } from "./components/StartJob";
import { Badge, Card, DangerButton, Empty, Field, Progress, StartButton } from "./components/ui";
import { AppContext } from "./context";
import { CONFIRM_KEY, duration } from "./model";
import { makeApp } from "./services/testkit";
import type { JobView } from "./types";

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
  window.localStorage.clear();
  vi.restoreAllMocks();
});

const app = makeApp("operator");

async function show(ui: React.ReactNode, value = app) {
  root = createRoot(box!);
  await act(async () => root!.render(<AppContext.Provider value={value}>{ui}</AppContext.Provider>));
}

async function settle(times = 4) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

const q = (selector: string) => box!.querySelector(selector);
const qa = (selector: string) => [...box!.querySelectorAll(selector)];
const buttons = () => qa("button") as HTMLButtonElement[];

async function click(el: Element | null | undefined) {
  expect(el, "the element to click").toBeTruthy();
  await act(async () => (el as HTMLElement).click());
}

function view(over: Partial<JobView> = {}): JobView {
  return {
    kind: "drill",
    name: "board",
    tools: [{ number: 1, spindle_rpm: 24000, count: 2, feed_mm_min: 1000, depth_mm: null, iterations: null }],
    holes: [
      { tool: 1, x_mm: 2, y_mm: 2 },
      { tool: 1, x_mm: 6, y_mm: 4 },
      { tool: 2, x_mm: 8, y_mm: 8 },
    ],
    paths: [],
    bounds_mm: [0, 0, 10, 10],
    items: 6,
    hole_ends: [2, 4, 6],
    estimate_s: 125,
    travel_mm: 40,
    ...over,
  };
}

describe("the parts of every page", () => {
  it("a card shows its title and its actions, and a card with neither has no header", async () => {
    await show(
      <>
        <Card title="Fleet" actions={<button>Reload</button>}>
          body
        </Card>
        <Card>plain</Card>
      </>,
    );
    const cards = qa("section.card");
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector("h3")?.textContent).toBe("Fleet");
    expect(cards[0].querySelector(".card-actions button")?.textContent).toBe("Reload");
    expect(cards[1].querySelector("header")).toBeNull();
  });

  it("a card asks for the wide layout only when it is told to", async () => {
    await show(
      <>
        <Card wide>a</Card>
        <Card>b</Card>
      </>,
    );
    expect(qa("section.card").map((c) => c.classList.contains("wide"))).toEqual([true, false]);
  });

  it("a card with only a title or only actions still has a header", async () => {
    await show(
      <>
        <Card title="Only title">a</Card>
        <Card actions={<i>x</i>}>b</Card>
      </>,
    );
    const heads = qa("header.card-head");
    expect(heads).toHaveLength(2);
    expect(heads[0].querySelector("h3")).not.toBeNull();
    expect(heads[1].querySelector("h3")).toBeNull();
  });

  it("a field wraps its input in a label with the hint under it, and has no hint when there is none", async () => {
    await show(
      <>
        <Field label="Name" hint="Letters only">
          <input />
        </Field>
        <Field label="Port">
          <input />
        </Field>
      </>,
    );
    const fields = qa("label.field");
    expect(fields[0].querySelector(".field-label")?.textContent).toBe("Name");
    expect(fields[0].querySelector("small.hint")?.textContent).toBe("Letters only");
    expect(fields[0].querySelector("input")).not.toBeNull();
    expect(fields[1].querySelector("small")).toBeNull();
  });

  it("the progress bar says its value to the screen readers and keeps it between 0 and 100", async () => {
    await show(
      <>
        <Progress percent={40} />
        <Progress percent={150} tone="ok" />
        <Progress percent={-20} tone="bad" />
      </>,
    );
    const bars = qa("[role=progressbar]");
    expect(bars.map((b) => b.getAttribute("aria-valuenow"))).toEqual(["40", "100", "0"]);
    expect(bars.map((b) => (b.querySelector("i") as HTMLElement).style.width)).toEqual(["40%", "100%", "0%"]);
    expect(bars[0].className).toBe("bar run");
    expect(bars[1].className).toBe("bar ok");
    expect(bars[2].className).toBe("bar bad");
    expect(bars[0].getAttribute("aria-valuemin")).toBe("0");
    expect(bars[0].getAttribute("aria-valuemax")).toBe("100");
  });

  it("a badge takes the class of its tone", async () => {
    await show(
      <>
        <Badge tone="ok">done</Badge>
        <Badge tone="dim">idle</Badge>
      </>,
    );
    expect(qa(".badge").map((b) => b.className)).toEqual(["badge ok", "badge dim"]);
    expect(qa(".badge").map((b) => b.textContent)).toEqual(["done", "idle"]);
  });

  it("the empty message is a paragraph", async () => {
    await show(<Empty>Nothing here</Empty>);
    expect(q("p.empty")?.textContent).toBe("Nothing here");
  });
});

describe("the buttons that ask once more", () => {
  it("a delete button needs a second touch and the second one is the confirmation", async () => {
    const done = vi.fn();
    await show(<DangerButton label="Delete" onConfirm={done} />);
    const button = () => buttons()[0];
    expect(button().textContent).toBe("Delete");
    await click(button());
    expect(done).not.toHaveBeenCalled();
    expect(button().textContent).toBe(app.t("sure"));
    expect(button().classList.contains("armed")).toBe(true);
    await click(button());
    expect(done).toHaveBeenCalledTimes(1);
    expect(button().textContent).toBe("Delete");
    expect(button().classList.contains("armed")).toBe(false);
  });

  it("leaving a delete button that was touched once disarms it", async () => {
    const done = vi.fn();
    await show(<DangerButton label="Delete" onConfirm={done} />);
    await click(buttons()[0]);
    await act(async () => {
      buttons()[0].dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    });
    expect(buttons()[0].textContent).toBe("Delete");
    await click(buttons()[0]);
    expect(done).not.toHaveBeenCalled();
  });

  it("a delete button that is off does nothing", async () => {
    const done = vi.fn();
    await show(<DangerButton label="Delete" onConfirm={done} disabled />);
    expect(buttons()[0].disabled).toBe(true);
    await click(buttons()[0]);
    expect(done).not.toHaveBeenCalled();
  });

  it("the start button asks first and starts at the second touch, then asks again", async () => {
    const start = vi.fn();
    await show(<StartButton label="Start" onConfirm={start} />);
    await click(buttons()[0]);
    expect(start).not.toHaveBeenCalled();
    expect(buttons()[0].textContent).toBe(app.t("sure"));
    await click(buttons()[0]);
    expect(start).toHaveBeenCalledTimes(1);
    expect(buttons()[0].textContent).toBe("Start");
    await click(buttons()[0]);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("a start button that is off cannot be armed", async () => {
    const start = vi.fn();
    await show(<StartButton label="Start" onConfirm={start} disabled />);
    await click(buttons()[0]);
    await click(buttons()[0]);
    expect(start).not.toHaveBeenCalled();
    expect(buttons()[0].textContent).toBe("Start");
  });
});

describe("the drawing of a job", () => {
  it("is an image with a label and the box of the work, with a margin, as its view", async () => {
    await show(<PlanView view={view()} label="The board" />);
    const svg = q("svg.plan")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.getAttribute("aria-label")).toBe("The board");
    expect(svg.getAttribute("viewBox")).toBe("-2 -2 14 14");
  });

  it("draws a circle for every hole in the colour of its tool, with Y going up", async () => {
    await show(<PlanView view={view()} label="x" />);
    const circles = qa("circle");
    expect(circles).toHaveLength(3);
    // the box is -2..12 high, so a hole at 2 mm is drawn at 10 - 2 = 8
    expect(circles.map((c) => c.getAttribute("cx"))).toEqual(["2", "6", "8"]);
    expect(circles.map((c) => c.getAttribute("cy"))).toEqual(["8", "6", "2"]);
    expect(circles[0].getAttribute("stroke")).toBe("#4cc9f0");
    expect(circles[2].getAttribute("stroke")).toBe("#f72585");
  });

  it("without progress no hole is done and none is the next one", async () => {
    await show(<PlanView view={view()} label="x" />);
    const circles = qa("circle");
    expect(circles.map((c) => c.getAttribute("fill"))).toEqual(["none", "none", "none"]);
    expect(new Set(circles.map((c) => c.getAttribute("r"))).size).toBe(1);
    expect(circles.map((c) => c.getAttribute("opacity"))).toEqual(["1", "1", "1"]);
  });

  it("the holes done are filled and faded and the next one is ringed larger", async () => {
    await show(<PlanView view={view()} label="x" itemsDone={2} />);
    const circles = qa("circle");
    // hole_ends [2, 4, 6]: two items done finish the first hole only
    expect(circles.map((c) => c.getAttribute("fill"))).toEqual(["#4cc9f0", "none", "none"]);
    expect(circles[0].getAttribute("opacity")).toBe("0.55");
    const base = Number(circles[0].getAttribute("r"));
    expect(Number(circles[1].getAttribute("r"))).toBeCloseTo(base * 1.5, 6);
    expect(Number(circles[2].getAttribute("r"))).toBeCloseTo(base, 6);
  });

  it("when every hole is done none is the next one", async () => {
    await show(<PlanView view={view()} label="x" itemsDone={6} />);
    expect(qa("circle").map((c) => c.getAttribute("fill"))).not.toContain("none");
    expect(new Set(qa("circle").map((c) => c.getAttribute("r"))).size).toBe(1);
  });

  it("routing paths are lines in the colour of their pen, flipped like the holes", async () => {
    const routing = view({ kind: "route", holes: [], paths: [{ pen: 2, points_mm: [[0, 0], [5, 5]] }, { tool: 3, points_mm: [[1, 1]] }, { points_mm: [] }] });
    await show(<PlanView view={routing} label="x" />);
    const lines = qa("polyline");
    expect(lines).toHaveLength(3);
    expect(lines[0].getAttribute("points")).toBe("0,10 5,5");
    expect(lines[0].getAttribute("stroke")).toBe("#f72585");
    expect(lines[1].getAttribute("stroke")).toBe("#b5e048");
    expect(lines[2].getAttribute("stroke")).toBe("#4cc9f0");
    expect(lines[2].getAttribute("points")).toBe("");
    expect(qa("circle")).toHaveLength(0);
  });

  it("a job with no bounds is drawn on a table of 100 x 80", async () => {
    await show(<PlanView view={view({ bounds_mm: null, holes: [], paths: [] })} label="x" />);
    expect(q("svg")!.getAttribute("viewBox")).toBe("0 0 100 80");
    expect(q("rect.plan-bg")).not.toBeNull();
  });

  it("the button that saves the drawing is named for the plan and makes a file named after the job", async () => {
    const saved: string[] = [];
    const urls = { create: vi.fn(() => "blob:plan"), revoke: vi.fn() };
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = urls.create;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = urls.revoke;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    await show(
      <div>
        <PlanView view={view()} label="x" />
        <PlanDownload name="My board #1" />
      </div>,
    );
    expect(buttons()[0].textContent).toBe(app.t("plan_save"));
    await click(buttons()[0]);
    expect(saved).toEqual(["My_board_1.svg"]);
    expect(urls.create).toHaveBeenCalledTimes(1);
    expect(urls.revoke).toHaveBeenCalledWith("blob:plan");
  });

  it("the save button does nothing when the page has no drawing", async () => {
    const create = vi.fn(() => "blob:plan");
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = create;
    await show(
      <div>
        <PlanDownload name="x" />
      </div>,
    );
    await click(buttons()[0]);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("the summary before a job starts", () => {
  it("says how many holes and tools, the size and the time", async () => {
    await show(<SummaryFacts view={view()} />);
    const text = q(".start-summary")!.textContent ?? "";
    expect(text).toContain(app.t("sum_count", { n: 3, tools: 1 }));
    expect(text).toContain("10 x 10 mm");
    expect(text).toContain(duration(125));
    expect(text).toContain("board");
  });

  it("counts the paths of a routing job and the items of a free program", async () => {
    await show(<SummaryFacts view={view({ kind: "route", holes: [], paths: [{ pen: 1, points_mm: [[0, 0]] }, { pen: 1, points_mm: [[1, 1]] }] })} />);
    expect(q("dd")!.textContent).toBe(app.t("sum_count", { n: 2, tools: 1 }));
  });

  it("the compact summary leaves the facts out", async () => {
    await show(<SummaryFacts view={view()} compact />);
    expect(q("dl.facts")).toBeNull();
  });

  it("without bounds or time there is no size and no time", async () => {
    await show(<SummaryFacts view={view({ bounds_mm: null, estimate_s: null })} />);
    const text = q(".start-summary")!.textContent ?? "";
    expect(text).not.toContain(app.t("sum_size"));
    expect(text).not.toContain(app.t("sum_time"));
  });

  it("a dry run inside the course is a hint and one outside is a warning, each with the reach of the axes", async () => {
    await show(<SummaryFacts view={view({ dry_run: { min_mm: [0, 0, 0], max_mm: [30, 20, 5], end_mm: [0, 0, 5], steps: 100, seconds: 12, within_course: true } })} />);
    expect(q("p.hint strong")?.textContent).toBe(app.t("sum_dry_ok"));
    expect(q("p code")?.textContent).toBe("X 0.0..30.0   Y 0.0..20.0   Z 0.0..5.0");
    await act(async () => root!.unmount());
    root = null;
    await show(<SummaryFacts view={view({ dry_run: { min_mm: [0, 0, 0], max_mm: [30, 20, 26.5], end_mm: [0, 0, 5], steps: 100, seconds: 12, within_course: false } })} />);
    expect(q("p.warn strong")?.textContent).toBe(app.t("sum_dry_bad"));
  });

  it("the time of the dry run is the one shown, before the estimate of the server", async () => {
    await show(<SummaryFacts view={view({ dry_run: { min_mm: [0, 0, 0], max_mm: [1, 1, 1], end_mm: [0, 0, 0], steps: 1, seconds: 61, within_course: true } })} />);
    expect(q(".start-summary")!.textContent).toContain(duration(61));
  });

  it("every warning of the work is a line of an alert", async () => {
    await show(<SummaryFacts view={view({ warnings: [{ code: "tiny", values: [0.52, 0.31] }, { code: "far", values: [4321.26] }] })} />);
    const lines = qa("[role=alert] li").map((li) => li.textContent);
    expect(lines).toEqual([app.t("warn_tiny", { w: 0.5, h: 0.3 }), app.t("warn_far", { d: 4321.3 })]);
  });

  it("with no warnings there is no alert", async () => {
    await show(<SummaryFacts view={view()} />);
    expect(q("[role=alert]")).toBeNull();
  });
});

describe("the button that starts a job", () => {
  function withJob(job: () => Promise<{ view: JobView | null }>): typeof app {
    return { ...app, api: { job } as unknown as Api };
  }

  it("with the summary turned off it asks 'Sure?' like the plain start button", async () => {
    window.localStorage.setItem(CONFIRM_KEY, "0");
    const start = vi.fn();
    await show(<StartJobButton jobId="j1" label="Start" onStart={start} />);
    await click(buttons()[0]);
    expect(buttons()[0].textContent).toBe(app.t("sure"));
    expect(q("[role=dialog]")).toBeNull();
    await click(buttons()[0]);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("with the summary on a touch opens it with the job read from the server", async () => {
    const job = vi.fn(async () => ({ view: view() }));
    const start = vi.fn();
    await show(<StartJobButton jobId="j1" label="Start" onStart={start} />, withJob(job));
    await click(buttons()[0]);
    await settle();
    expect(job).toHaveBeenCalledWith("j1");
    const dialog = q("[role=dialog]")!;
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-label")).toBe(app.t("sum_title"));
    expect(dialog.textContent).toContain(app.t("sum_count", { n: 3, tools: 1 }));
    expect(start).not.toHaveBeenCalled();
  });

  it("while the job is read the start inside the summary is off and the summary says so", async () => {
    let release: (v: { view: JobView | null }) => void = () => undefined;
    const job = () => new Promise<{ view: JobView | null }>((resolve) => (release = resolve));
    await show(<StartJobButton jobId="j1" label="Start" onStart={() => undefined} />, withJob(job));
    await click(buttons()[0]);
    expect(q("[role=dialog]")!.textContent).toContain(app.t("sum_loading"));
    const startInside = buttons().find((b) => b.textContent === app.t("sum_start"))!;
    expect(startInside.disabled).toBe(true);
    await act(async () => release({ view: view() }));
    await settle();
    expect(buttons().find((b) => b.textContent === app.t("sum_start"))!.disabled).toBe(false);
  });

  it("the start inside the summary closes it and starts the job", async () => {
    const start = vi.fn();
    await show(<StartJobButton jobId="j1" label="Start" onStart={start} />, withJob(async () => ({ view: view() })));
    await click(buttons()[0]);
    await settle();
    await click(buttons().find((b) => b.textContent === app.t("sum_start")));
    expect(start).toHaveBeenCalledTimes(1);
    expect(q("[role=dialog]")).toBeNull();
  });

  it("cancel closes the summary and starts nothing", async () => {
    const start = vi.fn();
    await show(<StartJobButton jobId="j1" label="Start" onStart={start} />, withJob(async () => ({ view: view() })));
    await click(buttons()[0]);
    await settle();
    await click(buttons().find((b) => b.textContent === app.t("sum_cancel")));
    expect(q("[role=dialog]")).toBeNull();
    expect(start).not.toHaveBeenCalled();
  });

  it("a job that cannot be read closes the summary and says why", async () => {
    const say = vi.fn();
    const failing = { ...withJob(async () => Promise.reject(new Error("gone"))), say };
    await show(<StartJobButton jobId="j1" label="Start" onStart={() => undefined} />, failing);
    await click(buttons()[0]);
    await settle();
    expect(q("[role=dialog]")).toBeNull();
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0][1]).toBe("error");
  });

  it("a button that is off does not open the summary", async () => {
    const job = vi.fn(async () => ({ view: view() }));
    await show(<StartJobButton jobId="j1" label="Start" onStart={() => undefined} disabled />, withJob(job));
    await click(buttons()[0]);
    expect(job).not.toHaveBeenCalled();
    expect(q("[role=dialog]")).toBeNull();
  });
});
