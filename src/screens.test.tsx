// @vitest-environment jsdom
/* The sign-in screen, the preview of a file of a project and the small helpers of the pages, drawn in a small DOM against doubles of the clients: what each one asks, what it shows and what it
 * leaves alone. The clients themselves (the API, the store of projects) are tested in the other files. */
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Api, ApiError } from "./api";
import { FilePreview } from "./components/FilePreview";
import { AppContext } from "./context";
import { errorText, text } from "./i18n";
import { Login } from "./pages/Login";
import { readPicked, saveBytes, useNowS, whenText } from "./services/format";
import { DEFAULT_LIMITS } from "./services/http";
import type { StoreClient } from "./services/store";
import { PREVIEW_MAX_BYTES } from "./services/store";
import { makeApp } from "./services/testkit";
import type { StoreFile, StoreVersion } from "./services/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let box: HTMLElement | null = null;

beforeEach(() => {
  box = document.createElement("div");
  document.body.appendChild(box);
});

afterEach(async () => {
  vi.useRealTimers();
  if (root) await act(async () => root!.unmount());
  root = null;
  box?.remove();
  box = null;
  vi.restoreAllMocks();
});

async function settle(times = 5) {
  for (let i = 0; i < times; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

async function render(ui: React.ReactNode) {
  root = createRoot(box!);
  await act(async () => root!.render(ui));
  await settle();
}

const q = (selector: string) => box!.querySelector(selector);
const qa = (selector: string) => [...box!.querySelectorAll(selector)];

async function typeInto(input: Element | null, value: string) {
  expect(input, "the input").toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input!.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function click(el: Element | null | undefined) {
  expect(el, "the element to click").toBeTruthy();
  await act(async () => (el as HTMLElement).click());
  await settle();
}

// ---- the sign-in screen

describe("the sign-in screen", () => {
  function fakeApi(over: Partial<Record<"setupNeeded" | "setup" | "login", unknown>> = {}) {
    const api = {
      setupNeeded: vi.fn(async () => false),
      setup: vi.fn(async () => ({})),
      login: vi.fn(async () => ({})),
      ...over,
    };
    return api as typeof api & Api;
  }
  const t = (k: Parameters<typeof text>[1], v?: Record<string, string | number>) => text("en", k, v);
  const submitButton = () => q("button[type=submit]") as HTMLButtonElement;
  const inputs = () => qa("input") as HTMLInputElement[];
  const nameInput = () => inputs()[0];
  const passwordInput = () => q("input[type=password]") as HTMLInputElement;
  const rememberBox = () => q("input[type=checkbox]") as HTMLInputElement;
  const submit = async () => {
    await act(async () => submitButton().form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
    await settle();
  };

  it("asks the server whether it needs the first administrator and shows the plain sign-in when it does not", async () => {
    const api = fakeApi();
    await render(<Login api={api} lang="en" onLang={() => undefined} onSignedIn={() => undefined} />);
    expect(api.setupNeeded).toHaveBeenCalledTimes(1);
    expect(q("p.muted")?.textContent).toBe(t("login_help"));
    expect(submitButton().textContent).toBe(t("login_signin"));
    expect(q("h1")?.textContent).toContain("STUDIO");
  });

  it("keeps the button off until there are a name and a password", async () => {
    await render(<Login api={fakeApi()} lang="en" onLang={() => undefined} onSignedIn={() => undefined} />);
    expect(submitButton().disabled).toBe(true);
    await typeInto(nameInput(), "ana");
    expect(submitButton().disabled).toBe(true);
    await typeInto(passwordInput(), "x");
    expect(submitButton().disabled).toBe(false);
    await typeInto(nameInput(), "   ");
    expect(submitButton().disabled).toBe(true);
  });

  it("signs in with the name trimmed and the password as it was typed, and tells it was not asked to remember", async () => {
    const api = fakeApi();
    const done = vi.fn();
    await render(<Login api={api} lang="en" onLang={() => undefined} onSignedIn={done} />);
    await typeInto(nameInput(), "  ana ");
    await typeInto(passwordInput(), " pass phrase ");
    await submit();
    expect(api.login).toHaveBeenCalledWith("ana", " pass phrase ");
    expect(api.setup).not.toHaveBeenCalled();
    expect(done).toHaveBeenCalledWith(false);
  });

  it("tells the application to remember the login only when the box was ticked", async () => {
    const done = vi.fn();
    await render(<Login api={fakeApi()} lang="en" onLang={() => undefined} onSignedIn={done} />);
    expect(rememberBox().checked).toBe(false);
    await typeInto(nameInput(), "ana");
    await typeInto(passwordInput(), "secret");
    await click(rememberBox());
    await submit();
    expect(done).toHaveBeenCalledWith(true);
  });

  it("shows the refusal of the server in the language of the screen and does not sign in", async () => {
    const refusal = new ApiError(401, "unauthorized", "");
    const api = fakeApi({ login: vi.fn(async () => Promise.reject(refusal)) });
    const done = vi.fn();
    await render(<Login api={api} lang="en" onLang={() => undefined} onSignedIn={done} />);
    await typeInto(nameInput(), "ana");
    await typeInto(passwordInput(), "wrong");
    await submit();
    expect(q("p.error")?.textContent).toBe(errorText("en", refusal));
    expect(done).not.toHaveBeenCalled();
    expect(submitButton().disabled).toBe(false);
  });

  it("clears the error of the last try when the person tries again", async () => {
    const login = vi.fn().mockRejectedValueOnce(new ApiError(401, "unauthorized", "")).mockResolvedValueOnce({});
    const done = vi.fn();
    await render(<Login api={fakeApi({ login })} lang="en" onLang={() => undefined} onSignedIn={done} />);
    await typeInto(nameInput(), "ana");
    await typeInto(passwordInput(), "secret");
    await submit();
    expect(q("p.error")).not.toBeNull();
    await submit();
    expect(q("p.error")).toBeNull();
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("a server that cannot be asked is shown as an error and the plain sign-in stays", async () => {
    const api = fakeApi({ setupNeeded: vi.fn(async () => Promise.reject(new ApiError(0, "unreachable", "no answer"))) });
    await render(<Login api={api} lang="en" onLang={() => undefined} onSignedIn={() => undefined} />);
    expect(q("p.error")?.textContent).toBe(errorText("en", new ApiError(0, "unreachable", "no answer")));
    expect(submitButton().textContent).toBe(t("login_signin"));
  });

  it("while the server has no user it asks for the set-up code and makes the administrator, then signs in", async () => {
    const api = fakeApi({ setupNeeded: vi.fn(async () => true) });
    const done = vi.fn();
    await render(<Login api={api} lang="en" onLang={() => undefined} onSignedIn={done} />);
    expect(q("p.muted")?.textContent).toBe(t("login_setup_help"));
    expect(submitButton().textContent).toBe(t("login_create"));
    expect(inputs()).toHaveLength(4);
    await typeInto(inputs()[0], " 123456 ");
    await typeInto(inputs()[1], "owner");
    await typeInto(passwordInput(), "a long enough phrase");
    await submit();
    expect(api.setup).toHaveBeenCalledWith("123456", "owner", "a long enough phrase");
    expect(api.login).toHaveBeenCalledWith("owner", "a long enough phrase");
    expect(done).toHaveBeenCalledWith(false);
  });

  it("the set-up needs the code, a valid name and a password of 8 to 128 characters", async () => {
    await render(<Login api={fakeApi({ setupNeeded: vi.fn(async () => true) })} lang="en" onLang={() => undefined} onSignedIn={() => undefined} />);
    await typeInto(inputs()[1], "owner");
    await typeInto(passwordInput(), "long enough");
    expect(submitButton().disabled).toBe(true);
    await typeInto(inputs()[0], "123456");
    expect(submitButton().disabled).toBe(false);
    await typeInto(passwordInput(), "short");
    expect(submitButton().disabled).toBe(true);
    await typeInto(passwordInput(), "long enough");
    await typeInto(inputs()[1], "not valid!");
    expect(submitButton().disabled).toBe(true);
    await typeInto(inputs()[1], "owner");
    await typeInto(passwordInput(), "x".repeat(129));
    expect(submitButton().disabled).toBe(true);
  });

  it("a set-up that is refused does not try to sign in", async () => {
    const api = fakeApi({ setupNeeded: vi.fn(async () => true), setup: vi.fn(async () => Promise.reject(new ApiError(403, "bad_code", ""))) });
    const done = vi.fn();
    await render(<Login api={api} lang="en" onLang={() => undefined} onSignedIn={done} />);
    await typeInto(inputs()[0], "000000");
    await typeInto(inputs()[1], "owner");
    await typeInto(passwordInput(), "long enough");
    await submit();
    expect(api.login).not.toHaveBeenCalled();
    expect(done).not.toHaveBeenCalled();
    expect(q("p.error")).not.toBeNull();
  });

  it("the form does not submit while it is not complete", async () => {
    const api = fakeApi();
    await render(<Login api={api} lang="en" onLang={() => undefined} onSignedIn={() => undefined} />);
    await submit();
    expect(api.login).not.toHaveBeenCalled();
  });

  it("the language list has every language and a change is told to the application", async () => {
    const onLang = vi.fn();
    await render(<Login api={fakeApi()} lang="en" onLang={onLang} onSignedIn={() => undefined} />);
    const select = q("select") as HTMLSelectElement;
    expect(select.options.length).toBeGreaterThanOrEqual(8);
    expect(select.value).toBe("en");
    await act(async () => {
      select.value = "es";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(onLang).toHaveBeenCalledWith("es");
  });

  it("the screen speaks the language it is given", async () => {
    await render(<Login api={fakeApi()} lang="es" onLang={() => undefined} onSignedIn={() => undefined} />);
    expect(submitButton().textContent).toBe(text("es", "login_signin"));
    expect(q("p.muted")?.textContent).toBe(text("es", "login_help"));
  });
});

// ---- the preview of a file of a project

describe("the preview of a file", () => {
  const TEXT = "T1\nX1Y1\nM30\n";
  const FILE: StoreFile = { name: "board.drl", version: 2, sha256: "a".repeat(64), size: TEXT.length, at: 1_700_000_000, by: "ana" };
  const VERSIONS: StoreVersion[] = [
    { version: 2, sha256: "a".repeat(64), size: 40, at: 1_700_000_100, by: "ana", comment: "second" },
    { version: 1, sha256: "b".repeat(64), size: 30, at: 1_700_000_000, by: "bob" },
  ];
  const app = makeApp("operator");
  const bytes = (s: string) => new TextEncoder().encode(s);

  function fakeStore(over: { versions?: () => Promise<StoreVersion[]>; read?: (...args: unknown[]) => Promise<{ bytes: Uint8Array; sha256: string }> } = {}) {
    const store = {
      versions: vi.fn(over.versions ?? (async () => VERSIONS)),
      read: vi.fn(over.read ?? (async () => ({ bytes: bytes(TEXT), sha256: "a".repeat(64) }))),
    };
    return store as typeof store & StoreClient;
  }

  async function show(store: StoreClient, file: StoreFile | null = FILE, extra: { onClose?: () => void; onDownload?: (n: string, v?: number) => void } = {}) {
    await render(
      <AppContext.Provider value={app}>
        <FilePreview store={store} projectId="p1" file={file} onClose={extra.onClose ?? (() => undefined)} onDownload={extra.onDownload ?? (() => undefined)} />
      </AppContext.Provider>,
    );
  }

  it("shows nothing without a file", async () => {
    const store = fakeStore();
    await show(store, null);
    expect(box!.innerHTML).toBe("");
    expect(store.versions).not.toHaveBeenCalled();
  });

  it("shows the text of a drilling file and the versions with their SHA-256", async () => {
    const store = fakeStore();
    await show(store);
    expect(q("h3")?.textContent).toBe("board.drl");
    expect(q("pre.log")?.textContent).toBe(TEXT);
    expect(qa("tbody tr")).toHaveLength(2);
    expect(qa("tbody code").map((c) => c.textContent)).toEqual(["a".repeat(12), "b".repeat(12)]);
    expect(qa("tbody code").map((c) => c.getAttribute("title"))).toEqual(["a".repeat(64), "b".repeat(64)]);
    expect(store.versions).toHaveBeenCalledWith("p1", "board.drl");
    expect(store.read).toHaveBeenCalledWith("p1", "board.drl", undefined, PREVIEW_MAX_BYTES);
  });

  it("marks the current version and shows who wrote each one and the comment", async () => {
    await show(fakeStore());
    const rows = qa("tbody tr");
    expect(rows[0].className).toBe("on");
    expect(rows[1].className).toBe("");
    expect(rows[0].textContent).toContain("second");
    expect(rows[0].textContent).toContain("ana");
    expect(rows[1].textContent).toContain("bob");
    expect(rows[0].textContent).toContain("v2");
  });

  it("an older version is read when its view button is touched and the view of the current version goes back to it", async () => {
    const store = fakeStore();
    await show(store);
    const view = (i: number) => qa("tbody tr")[i].querySelectorAll("button")[0];
    await click(view(1));
    expect(store.read).toHaveBeenLastCalledWith("p1", "board.drl", 1, PREVIEW_MAX_BYTES);
    expect(q("h3")?.textContent).toBe("board.drl · v1");
    expect(qa("tbody tr")[1].className).toBe("on");
    await click(view(0));
    expect(q("h3")?.textContent).toBe("board.drl");
    expect(qa("tbody tr")[0].className).toBe("on");
  });

  it("the download buttons hand over the name, and the version when it is one of the list", async () => {
    const onDownload = vi.fn();
    await show(fakeStore(), FILE, { onDownload });
    const head = qa(".card-actions button");
    await click(head[0]);
    expect(onDownload).toHaveBeenLastCalledWith("board.drl", undefined);
    await click(qa("tbody tr")[1].querySelectorAll("button")[1]);
    expect(onDownload).toHaveBeenLastCalledWith("board.drl", 1);
  });

  it("the close button tells the page", async () => {
    const onClose = vi.fn();
    await show(fakeStore(), FILE, { onClose });
    await click(qa(".card-actions button")[1]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a file that is not text or image is not read", async () => {
    const store = fakeStore();
    await show(store, { ...FILE, name: "board.zip" });
    expect(store.read).not.toHaveBeenCalled();
    expect(q("p.empty")?.textContent).toBe(app.t("pj_preview_binary"));
  });

  it("a file over the limit is not read either and says its size", async () => {
    const store = fakeStore();
    await show(store, { ...FILE, name: "big.txt", size: PREVIEW_MAX_BYTES + 1 });
    expect(store.read).not.toHaveBeenCalled();
    expect(q("p.empty")?.textContent).toContain("MB");
  });

  it("text with a zero byte inside is shown as binary", async () => {
    const store = fakeStore({ read: async () => ({ bytes: new Uint8Array([65, 0, 66]), sha256: "" }) });
    await show(store);
    expect(q("p.empty")?.textContent).toBe(app.t("pj_preview_binary"));
    expect(q("pre.log")).toBeNull();
  });

  it("a json file is shown indented", async () => {
    const store = fakeStore({ read: async () => ({ bytes: bytes('{"a":1,"b":[2]}'), sha256: "" }) });
    await show(store, { ...FILE, name: "settings.json", size: 15 });
    expect(q("pre.log")?.textContent).toBe(JSON.stringify({ a: 1, b: [2] }, null, 2));
  });

  it("a text longer than what was brought says that it was cut", async () => {
    const store = fakeStore({ read: async () => ({ bytes: bytes("line\n".repeat(10)), sha256: "" }) });
    await show(store, { ...FILE, size: 100 });
    expect(q("p.hint")).not.toBeNull();
  });

  it("an image is shown from the bytes with the name as its description, and its address is let go on leaving", async () => {
    const create = vi.fn(() => "blob:image");
    const revoke = vi.fn();
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = create;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revoke;
    const store = fakeStore({ read: async () => ({ bytes: new Uint8Array([137, 80, 78, 71]), sha256: "" }) });
    await show(store, { ...FILE, name: "photo.png", size: 4 });
    const image = q("img.preview-image") as HTMLImageElement;
    expect(image.getAttribute("src")).toBe("blob:image");
    expect(image.getAttribute("alt")).toBe("photo.png");
    await act(async () => root!.unmount());
    root = null;
    expect(revoke).toHaveBeenCalledWith("blob:image");
  });

  it("a file that cannot be read shows the refusal and a list of versions that cannot be read shows its own", async () => {
    const store = fakeStore({ read: async () => Promise.reject(new ApiError(404, "no_file", "")), versions: async () => Promise.reject(new ApiError(403, "forbidden", "")) });
    await show(store);
    const errors = qa("p.error").map((p) => p.textContent);
    expect(errors).toHaveLength(2);
    expect(errors).toContain(app.err(new ApiError(404, "no_file", "")));
    expect(errors).toContain(app.err(new ApiError(403, "forbidden", "")));
    expect(q("table")).toBeNull();
  });

  it("while the text is read the card says so", async () => {
    let release: (v: { bytes: Uint8Array; sha256: string }) => void = () => undefined;
    const store = fakeStore({ read: () => new Promise((resolve) => (release = resolve)) });
    await show(store);
    expect(q(".preview")?.textContent).toBe(app.t("svc_loading"));
    await act(async () => release({ bytes: bytes("done"), sha256: "" }));
    await settle();
    expect(q("pre.log")?.textContent).toBe("done");
  });
});

// ---- the small things the pages share

describe("the small helpers of the pages", () => {
  /** A file chosen on the computer, reduced to what the helper reads of it (its size and its bytes). */
  function pickedFile(values: number[]): File {
    return { size: values.length, arrayBuffer: async () => new Uint8Array(values).buffer } as unknown as File;
  }

  it("a time is written for the person and a missing one is a dash", () => {
    expect(whenText(null)).toBe("-");
    expect(whenText(undefined)).toBe("-");
    expect(whenText(0)).toBe("-");
    expect(whenText(-5)).toBe("-");
    expect(whenText(1_700_000_000)).toBe(new Date(1_700_000_000_000).toLocaleString());
  });

  it("a file is read into bytes", async () => {
    const bytes = await readPicked(pickedFile([1, 2, 3]));
    expect([...bytes]).toEqual([1, 2, 3]);
  });

  it("a file over the limit is refused before it is read", async () => {
    const file = pickedFile(new Array(10).fill(0));
    const read = vi.spyOn(file, "arrayBuffer");
    await expect(readPicked(file, 5)).rejects.toMatchObject({ status: 0, code: "upload_too_big", detail: "5" });
    expect(read).not.toHaveBeenCalled();
  });

  it("a file of exactly the limit is read and the default limit is the one of the uploads", async () => {
    const bytes = await readPicked(pickedFile(new Array(5).fill(7)), 5);
    expect(bytes.length).toBe(5);
    const huge = { size: DEFAULT_LIMITS.maxUpload + 1, arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File;
    await expect(readPicked(huge)).rejects.toBeInstanceOf(ApiError);
  });

  it("bytes are handed to the computer as a download with the name and the type given, and the address is let go later", async () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:file");
    const revoke = vi.fn();
    (URL as unknown as { createObjectURL: unknown }).createObjectURL = create;
    (URL as unknown as { revokeObjectURL: unknown }).revokeObjectURL = revoke;
    const clicked: { name: string; href: string }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ name: this.download, href: this.href });
    });
    saveBytes(new Uint8Array([1, 2]), "job.ncd", "text/plain");
    expect(clicked).toEqual([{ name: "job.ncd", href: "blob:file" }]);
    expect(document.querySelector("a[download]")).toBeNull();
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10000);
    expect(revoke).toHaveBeenCalledWith("blob:file");
    const blob = (create.mock.calls[0] as unknown[])[0] as Blob;
    expect(blob.type).toBe("text/plain");
    expect(blob.size).toBe(2);
  });

  it("the clock of a countdown follows the time every second while it is active and stops when it is not", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-01T00:00:00Z"));
    const seen: number[] = [];
    function Clock({ active }: { active: boolean }) {
      const now = useNowS(active);
      seen.push(now);
      return <span>{now}</span>;
    }
    root = createRoot(box!);
    await act(async () => root!.render(<Clock active />));
    const start = Math.floor(Date.now() / 1000);
    expect(box!.textContent).toBe(String(start));
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(box!.textContent).toBe(String(start + 3));
    await act(async () => root!.render(<Clock active={false} />));
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(box!.textContent).toBe(String(start + 3));
  });
});
