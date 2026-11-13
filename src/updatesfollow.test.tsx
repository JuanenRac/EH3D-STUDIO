// @vitest-environment jsdom
/* Following an update while the server restarts under it: the page of the updates against a server that answers from a table of routes and that, in the middle of the job,
 * stops answering or answers that the login has ended (the logins live in the memory of the server unless `persist_sessions` is on). */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Api, ApiError } from "./api";
import { AppContext } from "./context";
import type { AppState } from "./context";
import { makeErr, makeText } from "./context";
import { UpdatesPage } from "./pages/Configure";
import { reloadAfterUpdate, updatePhase } from "./model";
import { fakeServer, json, refusal } from "./services/testkit";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const components = [
  { id: "server", name: "EH3D-SERVER", installed: "0.0.1", latest: "0.0.2", newer: true, url: null, published: null, notes: "" },
  { id: "studio", name: "EH3D-STUDIO", installed: "0.0.1", latest: "0.0.1", newer: false, url: null, published: null, notes: "" },
];
const view = (patch: Record<string, unknown> = {}) => ({ enabled: true, pending: false, state: "idle", message: "", log: [], percent: 0, steps: [], history: [], components, ...patch });
const restarting = view({ state: "updating", message: "server: restarting", steps: [{ id: "server.restart", state: "running", percent: 50 }] });

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

const wait = (ms: number) => act(async () => void (await new Promise((r) => setTimeout(r, ms))));

async function show(answers: (n: number) => Response, signedOut: { count: number }) {
  let n = 0;
  const server = fakeServer({ "GET /updates": () => answers(n++) });
  const text = makeText("en");
  const err = makeErr("en");
  const app: AppState = {
    api: new Api("tok", server.fetcher, { normal: 500 }),
    session: { name: "ana", role: "admin", is_token: false },
    lang: "en",
    theme: "forge",
    refreshS: 0,
    alerts: false,
    t: text,
    err: (e) => {
      if (e instanceof ApiError && e.status === 401) signedOut.count++;
      return err(e);
    },
    say: () => undefined,
  };
  root = createRoot(box!);
  await act(async () => root!.render(<AppContext.Provider value={app}><UpdatesPage /></AppContext.Provider>));
  await wait(80);
  return { text: () => box!.textContent ?? "", phase: () => box!.querySelector("[data-phase]")?.getAttribute("data-phase") ?? "", button: (name: string) => [...box!.querySelectorAll("button")].find((b) => b.textContent?.trim() === name) as HTMLButtonElement | undefined };
}

describe("the phases of an update", () => {
  const busy = { pending: false, state: "updating" };
  it("tell the helper's states and the restart of the server apart", () => {
    expect(updatePhase({ view: null, failure: null })).toBe("idle");
    expect(updatePhase({ view: { pending: true, state: "idle" }, failure: null })).toBe("started");
    expect(updatePhase({ view: busy, failure: null })).toBe("applying");
    expect(updatePhase({ view: { pending: false, state: "checking" }, failure: null })).toBe("applying");
    expect(updatePhase({ view: { ...busy, steps: [{ id: "server.restart", state: "running" }] }, failure: null })).toBe("restarting");
    expect(updatePhase({ view: { ...busy, steps: [{ id: "server.restart", state: "done" }] }, failure: null })).toBe("applying");
    expect(updatePhase({ view: { pending: false, state: "done" }, failure: null })).toBe("done");
    expect(updatePhase({ view: { pending: false, state: "error" }, failure: null })).toBe("failed");
    expect(updatePhase({ view: { pending: false, state: "idle" }, failure: null })).toBe("idle");
  });

  it("see a server that does not answer as a restart until the time is up, and a refused login as the end of the login", () => {
    expect(updatePhase({ view: busy, failure: { status: 0 } })).toBe("restarting");
    expect(updatePhase({ view: busy, failure: { status: 503 } })).toBe("restarting");
    expect(updatePhase({ view: busy, failure: { status: 0 }, lost: true })).toBe("lost");
    expect(updatePhase({ view: busy, failure: { status: 401 } })).toBe("signed_out");
    expect(updatePhase({ view: busy, failure: { status: 401 }, lost: true })).toBe("signed_out");
    expect(updatePhase({ view: null, failure: { status: 0 } })).toBe("restarting");
  });

  it("reload the page only for the person who followed the update that replaced the pages of Studio", () => {
    const replaced = { state: "done", steps: [{ id: "studio.install", state: "done" }] };
    expect(reloadAfterUpdate(true, replaced)).toBe(true);
    expect(reloadAfterUpdate(false, replaced)).toBe(false);
    expect(reloadAfterUpdate(true, { state: "updating", steps: replaced.steps })).toBe(false);
    expect(reloadAfterUpdate(true, null)).toBe(false);
  });
});

describe("the page of the updates when the server restarts in the middle of one", () => {
  it("says that the login ended when the restarted server refuses it, instead of staying on 'updating'", async () => {
    const out = { count: 0 };
    const page = await show((n) => (n === 0 ? json(restarting) : refusal(401, "unauthorized")), out);
    // the page asks again as soon as it sees the helper busy, and the restarted server refuses the login
    expect(page.phase()).toBe("signed_out");
    expect(page.text()).toContain(makeText("en")("err_unauthorized"));
    // the buttons are back and the person can sign in again
    await act(async () => page.button("Sign in")!.click());
    expect(out.count).toBe(1);
  });

  it("keeps asking while the server does not answer and shows the result when it comes back", async () => {
    const out = { count: 0 };
    const page = await show((n) => (n === 0 ? json(restarting) : n === 1 ? refusal(503, "unavailable") : json(view({ state: "done", message: "updated: server" }))), out);
    expect(page.phase()).toBe("restarting");
    expect(page.text()).toContain(makeText("en")("up_waiting"));
    await wait(1300);
    expect(page.phase()).toBe("done");
    expect(out.count).toBe(0);
  });

  it("gives the buttons back and says the server did not answer when a restart takes too long to be one", async () => {
    // a server that never comes back: the first answer is the update in progress, the rest fail; the time limit is reached by the clock of the page
    const out = { count: 0 };
    const realNow = Date.now;
    let skew = 0;
    Date.now = () => realNow() + skew;
    try {
      const page = await show((n) => (n === 0 ? json(restarting) : refusal(502, "bad_gateway")), out);
      expect(page.phase()).toBe("restarting");
      skew = 10 * 60 * 1000;
      await wait(1300);
      expect(page.phase()).toBe("lost");
      expect(page.text()).toContain(makeText("en")("err_unreachable"));
      expect(page.button("Reload Studio")).toBeTruthy();
    } finally {
      Date.now = realNow;
    }
  });
});
