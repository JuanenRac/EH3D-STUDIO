// @vitest-environment jsdom
/* The hooks that watch the server from the shell of the application (the jobs that wait for the operator, whether the server answers), the bell and the notification they use, the
 * copy to the clipboard and the places the token is kept, run in a small DOM with a clock that the test moves by hand. */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Api } from "./api";
import { beep, shouldAlert, titleFor, useAttention, useReachable } from "./attention";
import { copyText, copyWithSelection } from "./clipboard";
import { TOKEN_KEY, browserStores, clearToken, readToken, saveToken } from "./tokenstore";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let box: HTMLElement | null = null;
const window_ = window as unknown as Record<string, unknown>;

beforeEach(() => {
  box = document.createElement("div");
  document.body.appendChild(box);
  document.title = "start";
});

afterEach(async () => {
  vi.useRealTimers();
  if (root) await act(async () => root!.unmount());
  root = null;
  box?.remove();
  box = null;
  delete window_.AudioContext;
  delete window_.Notification;
  vi.restoreAllMocks();
});

/** Moves the clock and lets the answers that were waiting arrive. */
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("the title and the alert", () => {
  it("the title counts the jobs that wait", () => {
    expect(titleFor(0)).toBe("EH3D Studio");
    expect(titleFor(1)).toBe("(1) EH3D Studio");
    expect(titleFor(12)).toBe("(12) EH3D Studio");
  });

  it("a negative count is not a reason to show a number", () => {
    expect(titleFor(-1)).toBe("EH3D Studio");
  });

  it("calls the person only when more jobs wait than the last time", () => {
    expect(shouldAlert(0, 1)).toBe(true);
    expect(shouldAlert(1, 2)).toBe(true);
    expect(shouldAlert(2, 2)).toBe(false);
    expect(shouldAlert(3, 1)).toBe(false);
    expect(shouldAlert(0, 0)).toBe(false);
  });
});

describe("the bell", () => {
  class FakeContext {
    static made: FakeContext[] = [];
    currentTime = 0;
    destination = { name: "speakers" };
    oscillators: { type: string; frequency: { value: number }; started: number[]; stopped: number[] }[] = [];
    closed = false;
    constructor() {
      FakeContext.made.push(this);
    }
    createOscillator() {
      const started: number[] = [];
      const stopped: number[] = [];
      const o = {
        type: "",
        frequency: { value: 0 },
        started,
        stopped,
        connect: (n: unknown) => n,
        start: (t: number) => {
          started.push(t);
        },
        stop: (t: number) => {
          stopped.push(t);
        },
      };
      this.oscillators.push(o);
      return o;
    }
    createGain() {
      const ramp = () => undefined;
      return { gain: { setValueAtTime: ramp, exponentialRampToValueAtTime: ramp }, connect: (n: unknown) => n };
    }
    close() {
      this.closed = true;
      return Promise.resolve();
    }
  }

  beforeEach(() => {
    FakeContext.made = [];
  });

  it("is silent in a browser that has no audio", () => {
    expect(() => beep()).not.toThrow();
    expect(FakeContext.made).toHaveLength(0);
  });

  it("plays two short notes, a fifth apart, and lets the audio go", () => {
    vi.useFakeTimers();
    window_.AudioContext = FakeContext;
    beep();
    const ctx = FakeContext.made[0];
    expect(FakeContext.made).toHaveLength(1);
    expect(ctx.oscillators.map((o) => o.frequency.value)).toEqual([880, 1174.66]);
    expect(ctx.oscillators.every((o) => o.type === "sine")).toBe(true);
    expect(ctx.oscillators[0].started[0]).toBeCloseTo(0, 6);
    expect(ctx.oscillators[1].started[0]).toBeCloseTo(0.22, 6);
    expect(ctx.oscillators[1].stopped[0]).toBeCloseTo(0.44, 6);
    expect(ctx.closed).toBe(false);
    vi.advanceTimersByTime(900);
    expect(ctx.closed).toBe(true);
  });

  it("uses the old name of the audio context when that is all there is", () => {
    window_.webkitAudioContext = FakeContext;
    try {
      beep();
      expect(FakeContext.made).toHaveLength(1);
    } finally {
      delete window_.webkitAudioContext;
    }
  });

  it("a browser that refuses the sound stays silent and does not break the page", () => {
    window_.AudioContext = class {
      constructor() {
        throw new Error("not allowed");
      }
    };
    expect(() => beep()).not.toThrow();
  });
});

describe("the jobs that wait for the operator", () => {
  function Watch(props: { api: Api; signedIn: boolean; seconds: number; alerts: boolean; message: string }) {
    useAttention(props.api, props.signedIn, props.seconds, props.alerts, props.message);
    return null;
  }

  function fakeApi(counts: (number | Error)[]) {
    let call = 0;
    const jobs = vi.fn(async () => {
      const next = counts[Math.min(call, counts.length - 1)];
      call += 1;
      if (next instanceof Error) throw next;
      return Array.from({ length: next }, (_, i) => ({ id: `j${i}` }));
    });
    return { jobs } as unknown as Api & { jobs: typeof jobs };
  }

  async function mount(api: Api, over: Partial<{ signedIn: boolean; seconds: number; alerts: boolean; message: string }> = {}) {
    vi.useFakeTimers();
    root = createRoot(box!);
    await act(async () => root!.render(<Watch api={api} signedIn seconds={10} alerts={false} message="a job waits" {...over} />));
    await advance(0);
  }

  class FakeNotification {
    static permission = "granted";
    static made: { title: string; body?: string }[] = [];
    constructor(title: string, options?: { body?: string }) {
      FakeNotification.made.push({ title, body: options?.body });
    }
  }

  beforeEach(() => {
    FakeNotification.made = [];
    FakeNotification.permission = "granted";
  });

  it("does not look and leaves the plain title while nobody is signed in", async () => {
    const api = fakeApi([3]);
    document.title = "(9) something";
    await mount(api, { signedIn: false });
    expect(api.jobs).not.toHaveBeenCalled();
    expect(document.title).toBe("EH3D Studio");
  });

  it("looks at once and puts the number of waiting jobs in the title", async () => {
    const api = fakeApi([2]);
    await mount(api);
    expect(api.jobs).toHaveBeenCalledTimes(1);
    expect(api.jobs).toHaveBeenCalledWith({ state: "waiting_operator" });
    expect(document.title).toBe("(2) EH3D Studio");
  });

  it("looks again every number of seconds the person chose and follows the title", async () => {
    const api = fakeApi([2, 0]);
    await mount(api, { seconds: 10 });
    await advance(9_999);
    expect(api.jobs).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(api.jobs).toHaveBeenCalledTimes(2);
    expect(document.title).toBe("EH3D Studio");
  });

  it("never looks more often than every five seconds", async () => {
    const api = fakeApi([0]);
    await mount(api, { seconds: 1 });
    await advance(4_999);
    expect(api.jobs).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(api.jobs).toHaveBeenCalledTimes(2);
  });

  it("with the alerts on, a new waiting job rings the bell and shows a notification with the message", async () => {
    window_.Notification = FakeNotification;
    window_.AudioContext = class {
      constructor() {
        throw new Error("no sound in the test");
      }
    };
    const api = fakeApi([0, 1, 1, 2]);
    await mount(api, { alerts: true, seconds: 5 });
    expect(FakeNotification.made).toHaveLength(0);
    await advance(5_000);
    expect(FakeNotification.made).toEqual([{ title: "EH3D Studio", body: "a job waits" }]);
    await advance(5_000);
    expect(FakeNotification.made).toHaveLength(1);
    await advance(5_000);
    expect(FakeNotification.made).toHaveLength(2);
  });

  it("with the alerts off nothing rings and nothing is shown", async () => {
    window_.Notification = FakeNotification;
    const api = fakeApi([0, 3]);
    await mount(api, { alerts: false, seconds: 5 });
    await advance(5_000);
    expect(FakeNotification.made).toHaveLength(0);
    expect(document.title).toBe("(3) EH3D Studio");
  });

  it("a notification the person did not allow is not shown", async () => {
    FakeNotification.permission = "denied";
    window_.Notification = FakeNotification;
    const api = fakeApi([0, 1]);
    await mount(api, { alerts: true, seconds: 5 });
    await advance(5_000);
    expect(FakeNotification.made).toHaveLength(0);
  });

  it("a browser without notifications does not break the alert", async () => {
    const api = fakeApi([0, 1]);
    await mount(api, { alerts: true, seconds: 5 });
    await advance(5_000);
    expect(document.title).toBe("(1) EH3D Studio");
  });

  it("a failed look is ignored and the title stays", async () => {
    const api = fakeApi([2, new Error("down")]);
    await mount(api, { seconds: 5 });
    await advance(5_000);
    expect(api.jobs).toHaveBeenCalledTimes(2);
    expect(document.title).toBe("(2) EH3D Studio");
  });

  it("stops looking when the page is left", async () => {
    const api = fakeApi([1]);
    await mount(api, { seconds: 5 });
    await act(async () => root!.unmount());
    root = null;
    await advance(30_000);
    expect(api.jobs).toHaveBeenCalledTimes(1);
  });

  it("an answer that arrives after the page was left is dropped", async () => {
    let release: (jobs: unknown[]) => void = () => undefined;
    const api = { jobs: vi.fn(() => new Promise((resolve) => (release = resolve))) } as unknown as Api;
    await mount(api, { seconds: 5 });
    document.title = "kept";
    await act(async () => root!.unmount());
    root = null;
    await act(async () => release([{ id: "a" }, { id: "b" }]));
    expect(document.title).toBe("kept");
  });
});

describe("whether the server answers", () => {
  function Reach(props: { api: Api; signedIn: boolean }) {
    const ok = useReachable(props.api, props.signedIn);
    return <span>{ok ? "yes" : "no"}</span>;
  }

  async function mount(api: Api, signedIn = true) {
    vi.useFakeTimers();
    root = createRoot(box!);
    await act(async () => root!.render(<Reach api={api} signedIn={signedIn} />));
  }

  it("is true to begin with and asks the health of the server every eight seconds", async () => {
    const api = { health: vi.fn(async () => ({})) } as unknown as Api & { health: ReturnType<typeof vi.fn> };
    await mount(api);
    expect(box!.textContent).toBe("yes");
    expect(api.health).not.toHaveBeenCalled();
    await advance(7_999);
    expect(api.health).not.toHaveBeenCalled();
    await advance(1);
    expect(api.health).toHaveBeenCalledTimes(1);
    await advance(8_000);
    expect(api.health).toHaveBeenCalledTimes(2);
  });

  it("turns false when the server does not answer and true again when it does", async () => {
    let up = false;
    const api = { health: vi.fn(async () => (up ? {} : Promise.reject(new Error("no answer")))) } as unknown as Api;
    await mount(api);
    await advance(8_000);
    expect(box!.textContent).toBe("no");
    up = true;
    await advance(8_000);
    expect(box!.textContent).toBe("yes");
  });

  it("does not ask while nobody is signed in", async () => {
    const api = { health: vi.fn(async () => ({})) } as unknown as Api & { health: ReturnType<typeof vi.fn> };
    await mount(api, false);
    await advance(60_000);
    expect(api.health).not.toHaveBeenCalled();
    expect(box!.textContent).toBe("yes");
  });

  it("stops asking when the page is left", async () => {
    const api = { health: vi.fn(async () => ({})) } as unknown as Api & { health: ReturnType<typeof vi.fn> };
    await mount(api);
    await act(async () => root!.unmount());
    root = null;
    await advance(60_000);
    expect(api.health).not.toHaveBeenCalled();
  });
});

describe("the clipboard", () => {
  function secure(on: boolean, writeText?: (t: string) => Promise<void>) {
    Object.defineProperty(window, "isSecureContext", { value: on, configurable: true });
    Object.defineProperty(navigator, "clipboard", { value: writeText ? { writeText } : undefined, configurable: true });
  }

  afterEach(() => {
    delete (document as unknown as Record<string, unknown>).execCommand;
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
  });

  it("on a secure page the clipboard of the browser is used", async () => {
    const writeText = vi.fn(async () => undefined);
    secure(true, writeText);
    expect(await copyText("hello")).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
  });

  it("when the browser refuses the clipboard the old way is tried", async () => {
    secure(true, async () => Promise.reject(new Error("no focus")));
    document.execCommand = vi.fn(() => true);
    expect(await copyText("hello")).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith("copy");
  });

  it("on a page that is not secure only the old way exists", async () => {
    const writeText = vi.fn(async () => undefined);
    secure(false, writeText);
    document.execCommand = vi.fn(() => true);
    expect(await copyText("hello")).toBe(true);
    expect(writeText).not.toHaveBeenCalled();
  });

  it("says that it did not work when the command is refused or does not exist", async () => {
    secure(false);
    document.execCommand = vi.fn(() => false);
    expect(await copyText("hello")).toBe(false);
    delete (document as unknown as Record<string, unknown>).execCommand;
    expect(await copyText("hello")).toBe(false);
  });

  it("the old way selects the text in a hidden box that it takes away again", () => {
    const seen: { value: string; hidden: string | null; readonly: boolean; selected: string }[] = [];
    document.execCommand = vi.fn(() => {
      const box = document.querySelector("textarea") as HTMLTextAreaElement;
      seen.push({ value: box.value, hidden: box.getAttribute("aria-hidden"), readonly: box.hasAttribute("readonly"), selected: box.value.slice(box.selectionStart, box.selectionEnd) });
      return true;
    });
    expect(copyWithSelection("12345")).toBe(true);
    expect(seen).toEqual([{ value: "12345", hidden: "true", readonly: true, selected: "12345" }]);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("the focus goes back to where it was", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    document.execCommand = vi.fn(() => true);
    copyWithSelection("x");
    expect(document.activeElement).toBe(button);
    button.remove();
  });

  it("the hidden box is taken away even when the command throws", () => {
    document.execCommand = vi.fn(() => {
      throw new Error("boom");
    });
    expect(copyWithSelection("x")).toBe(false);
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("without a page to write in it does nothing and says no", () => {
    expect(copyWithSelection("x", { body: null } as unknown as Document)).toBe(false);
  });
});

describe("where the login token is kept", () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it("the browser gives its two stores", () => {
    const stores = browserStores();
    expect(stores.session).not.toBeNull();
    expect(stores.local).not.toBeNull();
  });

  it("a token is kept for the tab by default and for the browser when the person asked to be remembered", () => {
    const stores = browserStores();
    expect(saveToken(stores, "t1", false)).toBe("session");
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBe("t1");
    expect(window.localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(saveToken(stores, "t2", true)).toBe("local");
    expect(window.localStorage.getItem(TOKEN_KEY)).toBe("t2");
    expect(window.sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(readToken(stores)).toBe("t2");
  });

  it("signing out takes the token from both stores", () => {
    const stores = browserStores();
    window.sessionStorage.setItem(TOKEN_KEY, "a");
    window.localStorage.setItem(TOKEN_KEY, "b");
    clearToken(stores);
    expect(readToken(stores)).toBeNull();
  });
});
