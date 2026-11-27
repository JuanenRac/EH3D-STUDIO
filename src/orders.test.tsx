// @vitest-environment jsdom
/* The orders that set a machine going: each one is sent once (a double click must not answer the next question of the machine), one that gets no answer is not told as a plain failure, a stop
 * that did not get there says so, and nothing sets a machine going from a page that shows old data. Against doubles of the server only. */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Api, ApiError, ORDER_HOLD_MS } from "./api";
import { DangerButton, StartButton } from "./components/ui";
import { AppContext } from "./context";
import { errorText, mayHaveArrived, orderErrorText, stopErrorText, text } from "./i18n";
import { JobPage } from "./pages/JobDetail";
import { makeApp } from "./services/testkit";
import type { Job } from "./types";

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
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function show(ui: React.ReactNode, value = makeApp("operator")) {
  root = createRoot(box!);
  await act(async () => root!.render(<AppContext.Provider value={value}>{ui}</AppContext.Provider>));
}

const button = () => box!.querySelector("button") as HTMLButtonElement;

/** A click as the browser tells it: `detail` is 1 for a single click and 2 for the second click of a double click. */
async function click(el: Element, detail = 1) {
  await act(async () => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, detail }));
  });
}

function counting(status = 200) {
  const sent: string[] = [];
  let answerStatus = status;
  const fetcher = async (input: string) => {
    sent.push(input.replace("/api/v1", ""));
    const body = answerStatus < 300 ? { id: "j2" } : { error: "not_in_state" };
    return new Response(JSON.stringify(body), { status: answerStatus });
  };
  return { api: new Api("t", fetcher), sent, answer: (s: number) => (answerStatus = s) };
}

describe("an order of a job is sent once", () => {
  it("does not send a second confirm while the first is on its way, nor a resume for the same question", async () => {
    const { api, sent } = counting();
    await Promise.all([api.confirmJob("a"), api.confirmJob("a"), api.resumeJob("a")]);
    expect(sent).toEqual(["/jobs/a/confirm"]);
  });

  it("holds the same order for a moment after the server took it, and lets it through afterwards", async () => {
    vi.useFakeTimers({ now: 1_000_000 });
    const { api, sent } = counting();
    await api.confirmJob("a");
    await api.confirmJob("a");
    expect(sent).toHaveLength(1);
    vi.setSystemTime(1_000_000 + ORDER_HOLD_MS + 1);
    await api.confirmJob("a");
    expect(sent).toHaveLength(2);
  });

  it("frees an order the server refused at once", async () => {
    const { api, sent, answer } = counting(409);
    await expect(api.startJob("a")).rejects.toThrow("not_in_state");
    answer(200);
    await api.startJob("a");
    expect(sent).toHaveLength(2);
  });

  it("makes one new job from a double press of go on, and keeps jobs apart", async () => {
    const { api, sent } = counting();
    const [one, two] = await Promise.all([api.resumeFrom("a"), api.resumeFrom("a")]);
    expect(two).toBe(one);
    await api.confirmJob("b");
    await api.confirmJob("c");
    expect(sent).toEqual(["/jobs/a/resume-from", "/jobs/b/confirm", "/jobs/c/confirm"]);
  });

  it("never holds back a stop", async () => {
    const { api, sent } = counting();
    await api.stopMachine("m1");
    await api.stopMachine("m1");
    expect(sent).toHaveLength(2);
  });
});

describe("the buttons and a double click", () => {
  it("a start button is not confirmed by the second click of a double click", async () => {
    const start = vi.fn();
    await show(<StartButton label="Start" onConfirm={start} />);
    await click(button(), 1);
    await click(button(), 2);
    expect(start).not.toHaveBeenCalled();
    await click(button(), 1);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it("a button that frees a machine takes two separate clicks; a stop takes the double click", async () => {
    const release = vi.fn();
    await show(<DangerButton deliberate label="Release" onConfirm={release} />);
    await click(button(), 1);
    await click(button(), 2);
    expect(release).not.toHaveBeenCalled();
    await act(async () => root!.unmount());
    const stop = vi.fn();
    await show(<DangerButton label="Stop" onConfirm={stop} />);
    await click(button(), 1);
    await click(button(), 2);
    expect(stop).toHaveBeenCalledTimes(1);
  });
});

describe("what is said when an order or a stop fails", () => {
  const lost = new ApiError(0, "timeout", "15000 ms");

  it("does not tell an order with no answer as one that did not happen", () => {
    for (const e of [lost, new ApiError(502, "http_502", ""), new ApiError(504, "http_504", "")]) {
      expect(mayHaveArrived(e)).toBe(true);
      expect(orderErrorText("en", e)).toBe(text("en", "cmd_unanswered"));
    }
    const refused = new ApiError(409, "machine_busy", "");
    expect(mayHaveArrived(refused)).toBe(false);
    expect(orderErrorText("en", refused)).toBe(errorText("en", refused));
  });

  it("says plainly that a stop did not get there", () => {
    for (const e of [lost, new ApiError(500, "internal", ""), new ApiError(401, "unauthorized", ""), new Error("x")]) expect(stopErrorText("es", e)).toBe(text("es", "stop_not_sent"));
    expect(stopErrorText("es", new ApiError(403, "forbidden", ""))).toBe(errorText("es", new ApiError(403, "forbidden", "")));
  });

  it("keeps the line and the reason of a refused program", () => {
    const e = new ApiError(422, "bad_gcode", "line 12: canned cycles are not followed");
    expect(errorText("en", e)).toBe(`${text("en", "err_bad_gcode")} (line 12: canned cycles are not followed)`);
    expect(text("en", "err_bad_gcode")).not.toContain("not G-code");
  });
});

describe("the page of a job with old data", () => {
  const job: Job = {
    id: "j1", machine: "m1", name: "board", kind: "drill", state: "waiting_operator", created: 1, started: 2, finished: null, by: "ana", items_total: 4, items_done: 1, holes_total: 4, holes_done: 1,
    message: null, pause: { kind: "tool_change", tool: 2 }, estimate_s: 10, view: null,
  };
  const named = (label: string) => [...box!.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;

  it("takes away confirm, and keeps the stop, when the server stops answering", async () => {
    vi.useFakeTimers();
    let up = true;
    const app = makeApp("operator");
    app.api = {
      job: async () => {
        if (!up) throw new ApiError(0, "unreachable", "");
        return job;
      },
    } as unknown as Api;
    await show(<JobPage id="j1" />, app);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    expect(named(app.t("act_confirm")).disabled).toBe(false);
    up = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3100);
    });
    expect(named(app.t("act_confirm")).disabled).toBe(true);
    expect(named(app.t("act_stop")).disabled).toBe(false);
    expect(box!.textContent).toContain(app.t("data_old"));
  });
});
