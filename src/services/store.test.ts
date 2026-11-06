import { describe, expect, it } from "vitest";
import { ApiError } from "../api";
import { INITIAL_EXPLORER, explorerReducer, remoteReducer } from "./explorer";
import {
  StoreClient,
  allTags,
  buildTree,
  bytesText,
  clock,
  downloadName,
  filterProjects,
  imageType,
  isConflict,
  joinPath,
  lockIsShort,
  lockView,
  plainName,
  prettyJson,
  previewKind,
  saveFile,
  sortProjects,
  tagFor,
  tagsOf,
  textPreview,
  totalBytes,
  validApp,
  validFileName,
  visibleRows,
  writeProblem,
} from "./store";
import { ServiceHttp } from "./http";
import { fakeServer, refusal } from "./testkit";
import type { StoreFile, StoreProjectSummary } from "./types";

const file = (name: string, size = 10, sha = `sha-${name}`, version = 1): StoreFile => ({ name, version, sha256: sha, size });
const project = (id: string, name: string, extra: Partial<StoreProjectSummary> = {}): StoreProjectSummary => ({ id, app: "studio", name, owner: "ana", etag: "e", ...extra });

describe("the client of the store", () => {
  it("asks for the projects of an application and reads a file with its tag and version", async () => {
    const s = fakeServer({
      "GET /apps/studio/projects": () => ({ total: 1, offset: 0, limit: 200, items: [project("p-1", "Board A")] }),
      "GET /apps/studio/projects/p-1/files/content": () => new Response(new Uint8Array([104, 105]), { headers: { etag: '"abc"' } }),
    });
    const store = new StoreClient(new ServiceHttp(() => "t", s.fetcher), "studio");
    const page = await store.list("a b");
    expect(page.items[0].id).toBe("p-1");
    expect(s.calls[0].query.get("q")).toBe("a b");
    expect(s.calls[0].query.get("limit")).toBe("200");
    const r = await store.read("p-1", "layers/top.gbr", 2);
    expect(new TextDecoder().decode(r.bytes)).toBe("hi");
    expect(r.sha256).toBe("abc");
    expect(s.calls[1].query.get("name")).toBe("layers/top.gbr");
    expect(s.calls[1].query.get("version")).toBe("2");
  });

  it("writes with the tag in If-Match, none for a new file, and the name and the comment in the query", async () => {
    const s = fakeServer({ "PUT /apps/studio/projects/p-1/files/content": () => ({ name: "a.txt", version: 2, sha256: "n", size: 1, unchanged: false }) });
    const store = new StoreClient(new ServiceHttp(() => "t", s.fetcher), "studio");
    await store.write("p-1", "a.txt", new Uint8Array([1]), { ifMatch: "old", comment: "second" });
    await store.write("p-1", "b.txt", new Uint8Array([1]));
    expect(s.calls[0].headers["if-match"]).toBe('"old"');
    expect(s.calls[0].query.get("comment")).toBe("second");
    expect(s.calls[1].headers["if-match"]).toBeUndefined();
    expect(s.calls[1].query.get("comment")).toBeNull();
  });

  it("removes and renames from the tag, takes and releases the lock, and exports and imports the container", async () => {
    const s = fakeServer({
      "DELETE /apps/studio/projects/p-1/files/content": () => ({ ok: true }),
      "PUT /apps/studio/projects/p-1": () => ({ id: "p-1" }),
      "PUT /apps/studio/projects/p-1/lock": () => ({ lock: { holder: "ana", expires: 99 } }),
      "DELETE /apps/studio/projects/p-1/lock": () => ({ ok: true }),
      "POST /apps/studio/projects/p-1/import": () => ({ imported: 2, unchanged: 1, files: [] }),
      "GET /apps/studio/projects/p-1/export": () => new Response(new Uint8Array([80, 75]), { headers: { "content-type": "application/zip" } }),
    });
    const store = new StoreClient(new ServiceHttp(() => "t", s.fetcher), "studio");
    await store.remove("p-1", "a.txt", "tag");
    await store.rename("p-1", "New", "rev");
    expect((await store.lock("p-1", 60))?.holder).toBe("ana");
    await store.unlock("p-1", true);
    expect((await store.importContainer("p-1", new Uint8Array([1]))).imported).toBe(2);
    expect(Array.from(await store.exportContainer("p-1", "1.1"))).toEqual([80, 75]);
    expect(s.calls[0].headers["if-match"]).toBe('"tag"');
    expect(s.calls[1].headers["if-match"]).toBe('"rev"');
    expect(s.calls[2].query.get("ttl_s")).toBe("60");
    expect(s.calls[3].query.get("force")).toBe("true");
    expect(s.calls[5].query.get("spec")).toBe("1.1");
  });

  it("puts the application and the project in the address with what needs escaping", async () => {
    const s = fakeServer({ "GET /apps/pcb/projects/a%2Fb": () => ({}) });
    const store = new StoreClient(new ServiceHttp(() => "t", s.fetcher), "pcb");
    await store.get("a/b").catch(() => undefined);
    expect(s.calls[0].path).toContain("/apps/pcb/projects/a%2Fb");
    expect(validApp("studio")).toBe(true);
    expect(validApp("Studio")).toBe(false);
    expect(validApp("a/b")).toBe(false);
  });
});

describe("the refusals of a write", () => {
  it("tell a changed file (412), a missing tag (428), a lock (423) and the limits apart", () => {
    expect(writeProblem(new ApiError(412, "precondition_failed", ""))).toBe("changed");
    expect(writeProblem(new ApiError(428, "precondition_required", ""))).toBe("needs_tag");
    expect(writeProblem(new ApiError(423, "locked", "ana"))).toBe("locked");
    expect(writeProblem(new ApiError(413, "file_too_big", ""))).toBe("too_big");
    expect(writeProblem(new ApiError(507, "project_quota", ""))).toBe("quota");
    expect(writeProblem(new ApiError(422, "bad_filename", ""))).toBe("bad_name");
    expect(writeProblem(new ApiError(500, "internal", ""))).toBe("other");
    expect(writeProblem(new Error("x"))).toBe("other");
    expect(isConflict(new ApiError(412, "x", ""))).toBe(true);
    expect(isConflict(new ApiError(507, "x", ""))).toBe(false);
  });

  it("take the tag of a write from the list the person saw", () => {
    const seen = [file("a.txt", 1, "sha-a"), file("b/c.txt", 1, "sha-c")];
    expect(tagFor(seen, "a.txt")).toBe("sha-a");
    expect(tagFor(seen, "b/c.txt")).toBe("sha-c");
    expect(tagFor(seen, "new.txt")).toBeNull();
  });

  it("are a warning to look again, not a failure, when a file is saved: 412, 428 and 423 are conflicts", async () => {
    const seen = [file("a.txt", 1, "old")];
    const failing = (status: number, code: string) => ({ write: async () => Promise.reject(new ApiError(status, code, "ana")) });
    for (const [status, code, problem] of [
      [412, "precondition_failed", "changed"],
      [428, "precondition_required", "needs_tag"],
      [423, "locked", "locked"],
    ] as const) {
      const out = await saveFile(failing(status, code), "p", "a.txt", new Uint8Array(), seen);
      expect(out).toMatchObject({ kind: "conflict", problem, detail: "ana" });
    }
    const quota = await saveFile(failing(507, "project_quota"), "p", "a.txt", new Uint8Array(), seen);
    expect(quota.kind).toBe("failed");
  });

  it("send the tag of the seen version and say whether the file was new", async () => {
    const sent: (string | null | undefined)[] = [];
    const store = {
      write: async (_p: string, name: string, _b: Uint8Array, o: { ifMatch?: string | null }) => {
        sent.push(o.ifMatch);
        return { name, version: 3, sha256: "n", size: 1, unchanged: false };
      },
    };
    const first = await saveFile(store, "p", "a.txt", new Uint8Array(), [file("a.txt", 1, "old")], "why");
    const second = await saveFile(store, "p", "z.txt", new Uint8Array(), []);
    expect(sent).toEqual(["old", null]);
    expect(first).toMatchObject({ kind: "saved", created: false });
    expect(second).toMatchObject({ kind: "saved", created: true });
  });

  it("go through a server that refuses with 412 and then accepts with the fresh tag", async () => {
    let tag = "v1";
    const s = fakeServer({
      "PUT /apps/studio/projects/p-1/files/content": (c) => (c.headers["if-match"] === `"${tag}"` ? { name: "a", version: 2, sha256: "n", size: 1, unchanged: false } : refusal(412, "precondition_failed")),
    });
    const store = new StoreClient(new ServiceHttp(() => "t", s.fetcher), "studio");
    tag = "v2";
    const stale = await saveFile(store, "p-1", "a", new Uint8Array([1]), [file("a", 1, "v1")]);
    expect(stale).toMatchObject({ kind: "conflict", problem: "changed" });
    const fresh = await saveFile(store, "p-1", "a", new Uint8Array([1]), [file("a", 1, "v2")]);
    expect(fresh.kind).toBe("saved");
  });
});

describe("the list of the projects", () => {
  const list = [
    project("1", "Board A #prototype #rev2", { updated: 30, files: 3, owner: "ana" }),
    project("2", "Panel B #prototype", { updated: 20, files: 9, owner: "bob" }),
    project("3", "Laser jig", { updated: 40, files: 1, owner: "ana" }),
  ];

  it("reads the tags of a name and the name without them", () => {
    expect(tagsOf("Board A #Prototype #rev2 #prototype")).toEqual(["prototype", "rev2"]);
    expect(tagsOf("no tags")).toEqual([]);
    expect(plainName("Board A #prototype #rev2")).toBe("Board A");
    expect(plainName("#only")).toBe("#only");
  });

  it("counts the tags, the most used first", () => {
    expect(allTags(list)).toEqual([
      { tag: "prototype", count: 2 },
      { tag: "rev2", count: 1 },
    ]);
  });

  it("searches by all the words in the name, the id or the owner, and narrows by tag and by owner", () => {
    const f = { query: "", tag: "", mine: false, me: "ana" };
    expect(filterProjects(list, f)).toHaveLength(3);
    expect(filterProjects(list, { ...f, query: "board proto" }).map((p) => p.id)).toEqual(["1"]);
    expect(filterProjects(list, { ...f, query: "BOB" }).map((p) => p.id)).toEqual(["2"]);
    expect(filterProjects(list, { ...f, tag: "prototype" })).toHaveLength(2);
    expect(filterProjects(list, { ...f, mine: true }).map((p) => p.id)).toEqual(["1", "3"]);
    expect(filterProjects(list, { ...f, query: "nothing like it" })).toEqual([]);
  });

  it("sorts by the latest change, by name and by the number of files", () => {
    expect(sortProjects(list, "updated").map((p) => p.id)).toEqual(["3", "1", "2"]);
    expect(sortProjects(list, "name").map((p) => p.id)).toEqual(["1", "3", "2"]);
    expect(sortProjects(list, "files").map((p) => p.id)).toEqual(["2", "1", "3"]);
  });
});

describe("the tree of the files", () => {
  const files = [file("project.json", 5), file("layers/top.gbr", 100), file("layers/bottom.gbr", 200), file("docs/notes/a.md", 7), file("z.txt", 1)];

  it("puts the folders first, each side in alphabetical order, with the sizes added up", () => {
    const tree = buildTree(files);
    expect(tree.map((n) => n.name)).toEqual(["docs", "layers", "project.json", "z.txt"]);
    const layers = tree.find((n) => n.name === "layers")!;
    expect(layers.folder).toBe(true);
    expect(layers.size).toBe(300);
    expect(layers.count).toBe(2);
    expect(layers.children.map((n) => n.name)).toEqual(["bottom.gbr", "top.gbr"]);
    expect(layers.children[0].file?.size).toBe(200);
    expect(tree[0].children[0].name).toBe("notes");
  });

  it("lists the rows in view without the contents of a collapsed folder", () => {
    const tree = buildTree(files);
    expect(visibleRows(tree, new Set()).map((n) => n.path)).toEqual(["docs", "docs/notes", "docs/notes/a.md", "layers", "layers/bottom.gbr", "layers/top.gbr", "project.json", "z.txt"]);
    expect(visibleRows(tree, new Set(["layers", "docs"])).map((n) => n.path)).toEqual(["docs", "layers", "project.json", "z.txt"]);
    expect(visibleRows(tree, new Set()).find((n) => n.path === "docs/notes/a.md")?.depth).toBe(2);
  });

  it("keeps a file and a folder of one name apart", () => {
    const tree = buildTree([file("a", 1), file("a/b", 1)]);
    expect(tree).toHaveLength(2);
    expect(tree.map((n) => n.folder)).toEqual([true, false]);
  });

  it("adds the sizes and writes them", () => {
    expect(totalBytes(files)).toBe(313);
    expect(bytesText(512)).toBe("512 B");
    expect(bytesText(2048)).toBe("2.0 KB");
    expect(bytesText(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("the lock", () => {
  it("is free once its time has passed, and says whose it is and how long is left", () => {
    expect(lockView(null, "ana", 100)).toEqual({ state: "free" });
    expect(lockView({ holder: "ana", expires: 100 }, "ana", 100)).toEqual({ state: "free" });
    expect(lockView({ holder: "ana", expires: 160 }, "ana", 100)).toEqual({ state: "mine", holder: "ana", remainingS: 60 });
    expect(lockView({ holder: "bob", expires: 160 }, "ana", 100)).toEqual({ state: "other", holder: "bob", remainingS: 60 });
  });

  it("writes the time left as minutes and seconds, or with hours", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(65)).toBe("1:05");
    expect(clock(3725)).toBe("1:02:05");
    expect(clock(-5)).toBe("0:00");
  });

  it("is marked as short in its last minute or last tenth", () => {
    expect(lockIsShort({ holder: "a", since: 0, expires: 1000 }, 950)).toBe(true);
    expect(lockIsShort({ holder: "a", since: 0, expires: 1000 }, 100)).toBe(false);
    expect(lockIsShort({ holder: "a", since: 0, expires: 10000 }, 8900)).toBe(false);
    expect(lockIsShort({ holder: "a", since: 0, expires: 10000 }, 9100)).toBe(true);
  });
});

describe("what can be shown of a file", () => {
  it("tells images, texts (also drilling, G-code and Gerber) and the rest by the extension", () => {
    expect(previewKind("a/b.PNG")).toBe("image");
    expect(previewKind("shot.svg")).toBe("image");
    for (const n of ["board.gtl", "drill.drl", "job.NCD", "tools.dtd", "path.nc", "x.gcode", "r.json", "notes.md", "layers/top.gbr"]) expect(previewKind(n), n).toBe("text");
    expect(previewKind("container.eh3dproj")).toBe("binary");
    expect(previewKind("noextension")).toBe("binary");
    expect(imageType("a.jpg")).toBe("image/jpeg");
    expect(imageType("a.xyz")).toBe("application/octet-stream");
  });

  it("cuts a text by lines and by characters and says it was cut", () => {
    const bytes = new TextEncoder().encode(Array.from({ length: 50 }, (_, i) => `G1 X${i}`).join("\n"));
    const p = textPreview(bytes, { maxLines: 10 });
    expect(p.text.split("\n")).toHaveLength(10);
    expect(p.truncated).toBe(true);
    expect(p.binary).toBe(false);
    expect(textPreview(bytes, { maxChars: 20 }).text).toHaveLength(20);
    const whole = textPreview(new TextEncoder().encode("one\ntwo"));
    expect(whole).toMatchObject({ text: "one\ntwo", truncated: false, lines: 2 });
  });

  it("says a text is cut when the file is longer than what was downloaded", () => {
    expect(textPreview(new TextEncoder().encode("abc"), { fileSize: 9999 }).truncated).toBe(true);
  });

  it("does not show bytes with a NUL as text", () => {
    expect(textPreview(new Uint8Array([65, 0, 66])).binary).toBe(true);
  });

  it("writes a JSON text with indentation and leaves other texts alone", () => {
    expect(prettyJson('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyJson("not json")).toBe("not json");
  });
});

describe("the names", () => {
  it("catch the names the server certainly refuses", () => {
    for (const bad of ["", "/abs", "a\\b", "C:x", "a/../b", "./a", "a//b", "a/", "x\u0001y", "name.", "dir /f", "a".repeat(241)]) expect(validFileName(bad), JSON.stringify(bad)).toBe(false);
    for (const good of ["a.txt", "layers/top.gbr", "docs/notes/a b.md", "ünïcode.txt"]) expect(validFileName(good), good).toBe(true);
  });

  it("join the folder and the name, and make a safe name for a download", () => {
    expect(joinPath("layers", "top.gbr")).toBe("layers/top.gbr");
    expect(joinPath("/layers/", "top.gbr")).toBe("layers/top.gbr");
    expect(joinPath("", "top.gbr")).toBe("top.gbr");
    expect(downloadName("layers/top.gbr", ".v2")).toBe("top.gbr.v2");
    expect(downloadName("My Board #1", ".eh3dproj")).toBe("My_Board_1.eh3dproj");
    expect(downloadName("???")).toBe("project");
  });
});

describe("the state of the explorer", () => {
  it("keeps what was loaded while it loads again, and when it fails", () => {
    let r = remoteReducer<number>({ status: "idle", data: null, error: null }, { type: "load" });
    expect(r.status).toBe("loading");
    r = remoteReducer(r, { type: "ok", data: 5 });
    expect(r).toEqual({ status: "ready", data: 5, error: null });
    r = remoteReducer(r, { type: "load" });
    expect(r).toEqual({ status: "loading", data: 5, error: null });
    r = remoteReducer(r, { type: "fail", error: "x" });
    expect(r).toEqual({ status: "error", data: 5, error: "x" });
    expect(remoteReducer(r, { type: "reset" }).data).toBeNull();
  });

  it("loads the list with its total and forgets the detail of a project when another is chosen", () => {
    let s = explorerReducer(INITIAL_EXPLORER, { type: "projects_load" });
    expect(s.projects.status).toBe("loading");
    s = explorerReducer(s, { type: "projects_ok", items: [project("1", "A")], total: 7 });
    expect(s.projects.data).toHaveLength(1);
    expect(s.total).toBe(7);
    s = explorerReducer(s, { type: "select", id: "1" });
    s = explorerReducer(s, { type: "file", name: "a.txt" });
    s = explorerReducer(s, { type: "conflict", notice: { problem: "changed", name: "a.txt", detail: "" } });
    s = explorerReducer(s, { type: "toggle_folder", path: "layers" });
    expect(s.collapsed).toEqual(["layers"]);
    s = explorerReducer(s, { type: "select", id: "2" });
    expect(s).toMatchObject({ selected: "2", file: null, conflict: null, collapsed: [] });
    expect(explorerReducer(s, { type: "select", id: "2" })).toBe(s);
    const failed = explorerReducer(s, { type: "projects_fail", error: new Error("x") });
    expect(failed.projects.status).toBe("error");
    expect(failed.projects.data).toHaveLength(1);
  });

  it("opens and closes folders, picks a tag and takes it off by picking it again", () => {
    let s = explorerReducer(INITIAL_EXPLORER, { type: "toggle_folder", path: "a" });
    s = explorerReducer(s, { type: "toggle_folder", path: "b" });
    s = explorerReducer(s, { type: "toggle_folder", path: "a" });
    expect(s.collapsed).toEqual(["b"]);
    expect(explorerReducer(s, { type: "expand_all" }).collapsed).toEqual([]);
    s = explorerReducer(s, { type: "tag", tag: "x" });
    expect(s.tag).toBe("x");
    expect(explorerReducer(s, { type: "tag", tag: "x" }).tag).toBe("");
    expect(explorerReducer(s, { type: "query", query: "q" }).query).toBe("q");
    expect(explorerReducer(s, { type: "mine", mine: true }).mine).toBe(true);
    expect(explorerReducer(s, { type: "order", order: "name" }).order).toBe("name");
  });
});
