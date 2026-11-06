/*
 * The project store of the server (`/api/v1/apps/{app}/projects`, docs/PROJECT_STORE.md of EH3D-SERVER): the client with one method per request, and the rules the explorer
 * decides with, none of which touches the page: the tree of the files, the search and the tags of the list, the tag (`If-Match`) of a write and what its refusals mean, the
 * lock with its time left, and what can be shown of a file. GPL-3.0-or-later.
 */
import { ApiError } from "../api";
import { quoteTag, unquoteTag } from "./http";
import type { ServiceHttp } from "./http";
import type { StoreFile, StoreImportResult, StoreLock, StoreLockState, StoreProject, StoreProjectPage, StoreProjectSummary, StoreVersion, StoreVersionList, StoreWriteResult } from "./types";

/** The most bytes of a text that a preview downloads and shows. */
export const PREVIEW_MAX_BYTES = 2 * 1024 * 1024;
/** The most characters of a text that a preview shows (the rest is cut and the page says so). */
export const PREVIEW_TEXT_CHARS = 60000;
/** The most lines of a text that a preview shows. */
export const PREVIEW_TEXT_LINES = 1500;
/** The most bytes of a container that an export brings. */
export const EXPORT_MAX_BYTES = 128 * 1024 * 1024;

export interface FileRead {
  bytes: Uint8Array;
  /** The tag of the version that was read (its SHA-256). */
  sha256: string | null;
}

/** The `app` of a project store is a name the server accepts: lower case letters, digits and hyphens. */
export function validApp(app: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,31}$/.test(app);
}

export class StoreClient {
  constructor(
    private http: ServiceHttp,
    readonly app: string,
  ) {}

  private base(id?: string): string {
    const root = `/apps/${encodeURIComponent(this.app)}/projects`;
    return id === undefined ? root : `${root}/${encodeURIComponent(id)}`;
  }

  list = (q = "", limit = 200, offset = 0) => this.http.json<StoreProjectPage>("GET", this.base(), { query: { q, limit, offset } });
  get = (id: string) => this.http.json<StoreProject>("GET", this.base(id));
  create = (name: string) => this.http.json<StoreProject>("POST", this.base(), { json: { name } });
  /** The project is renamed from the revision it was read at: its tag goes in `If-Match`. */
  rename = (id: string, name: string, etag: string) => this.http.json<StoreProject>("PUT", this.base(id), { json: { name }, headers: { "if-match": quoteTag(etag) } });
  hide = (id: string) => this.http.json<unknown>("DELETE", this.base(id));
  purge = (id: string) => this.http.json<unknown>("POST", `${this.base(id)}/purge`, { json: {} });

  files = async (id: string) => (await this.http.json<{ files: StoreFile[] }>("GET", `${this.base(id)}/files`)).files;
  versions = async (id: string, name: string): Promise<StoreVersion[]> => (await this.http.json<StoreVersionList>("GET", `${this.base(id)}/files/versions`, { query: { name } })).versions;

  /** The bytes of a file (an older version with `version`), at most `max` of them. */
  async read(id: string, name: string, version?: number, max?: number): Promise<FileRead> {
    const r = await this.http.send("GET", `${this.base(id)}/files/content`, { query: { name, version }, transfer: true, maxDownload: max });
    return { bytes: r.body, sha256: unquoteTag(r.headers.get("etag")) };
  }

  /** Writes a file as a new version. A file that exists is written from the version the person saw: its tag goes in `If-Match`; a new file takes none. */
  async write(id: string, name: string, bytes: Uint8Array, opts: { ifMatch?: string | null; comment?: string } = {}): Promise<StoreWriteResult> {
    const headers: Record<string, string> = {};
    if (opts.ifMatch) headers["if-match"] = quoteTag(opts.ifMatch);
    return this.http.json<StoreWriteResult>("PUT", `${this.base(id)}/files/content`, { query: { name, comment: opts.comment }, bytes, headers, transfer: true });
  }

  remove = (id: string, name: string, ifMatch: string) =>
    this.http.json<unknown>("DELETE", `${this.base(id)}/files/content`, { query: { name }, headers: { "if-match": quoteTag(ifMatch) } });

  lockState = async (id: string) => (await this.http.json<StoreLockState>("GET", `${this.base(id)}/lock`)).lock;
  lock = async (id: string, ttlS?: number) => (await this.http.json<StoreLockState>("PUT", `${this.base(id)}/lock`, { query: { ttl_s: ttlS }, json: {} })).lock;
  unlock = (id: string, force = false) => this.http.json<unknown>("DELETE", `${this.base(id)}/lock`, { query: { force: force ? "true" : undefined } });

  /** Imports an `.eh3dproj` container: every entry becomes a new version of the file of that name, all of it or none. */
  importContainer = (id: string, bytes: Uint8Array) => this.http.json<StoreImportResult>("POST", `${this.base(id)}/import`, { bytes, contentType: "application/octet-stream", transfer: true });
  /** The current files as an `.eh3dproj` container (`spec` 1.0 or 1.1). */
  async exportContainer(id: string, spec?: "1.0" | "1.1"): Promise<Uint8Array> {
    const r = await this.http.send("GET", `${this.base(id)}/export`, { query: { spec }, transfer: true, maxDownload: EXPORT_MAX_BYTES });
    return r.body;
  }
}

// ---- the tag of a write and what its refusals mean

/** What went wrong with a write, for the sentence the page shows: somebody changed the file (412), the tag is missing (428), somebody holds the lock (423), or a limit. */
export type WriteProblem = "changed" | "needs_tag" | "locked" | "too_big" | "quota" | "bad_name" | "other";

export function writeProblem(e: unknown): WriteProblem {
  if (!(e instanceof ApiError)) return "other";
  if (e.status === 412 || e.code === "precondition_failed") return "changed";
  if (e.status === 428 || e.code === "precondition_required") return "needs_tag";
  if (e.status === 423 || e.code === "locked") return "locked";
  if (e.status === 413 || e.code === "file_too_big") return "too_big";
  if (e.status === 507 || e.code === "project_quota") return "quota";
  if (e.code === "bad_filename") return "bad_name";
  return "other";
}

/** A conflict is a refusal the person solves by looking again (somebody else changed the file, or holds the project), not a failure of the server. */
export function isConflict(e: unknown): boolean {
  const p = writeProblem(e);
  return p === "changed" || p === "needs_tag" || p === "locked";
}

/** The tag a write over `name` must carry: the SHA-256 of the version of the list the person saw; null for a file that is not in the list (a new file takes no tag). */
export function tagFor(files: readonly StoreFile[], name: string): string | null {
  return files.find((f) => f.name === name)?.sha256 ?? null;
}

export type SaveOutcome =
  | { kind: "saved"; result: StoreWriteResult; created: boolean }
  | { kind: "conflict"; problem: "changed" | "needs_tag" | "locked"; detail: string }
  | { kind: "failed"; error: unknown };

/** Writes a file with the tag handled: from the list the person saw (or from the one just asked for when it was not given). A refusal of 412, 428 or 423 is a conflict
 * for the page to warn about (the person looks again and decides); anything else is a failure. */
export async function saveFile(store: Pick<StoreClient, "write">, id: string, name: string, bytes: Uint8Array, seen: readonly StoreFile[], comment?: string): Promise<SaveOutcome> {
  const tag = tagFor(seen, name);
  try {
    const result = await store.write(id, name, bytes, { ifMatch: tag, comment });
    return { kind: "saved", result, created: tag === null };
  } catch (e) {
    const problem = writeProblem(e);
    if (problem === "changed" || problem === "needs_tag" || problem === "locked") return { kind: "conflict", problem, detail: e instanceof ApiError ? e.detail : "" };
    return { kind: "failed", error: e };
  }
}

// ---- the list of the projects: search and tags, on the side of the client

/** The tags of a project: the words written with a `#` in its name (`Board A #prototype #rev2`). */
export function tagsOf(name: string): string[] {
  const found = name.match(/#[^\s#]+/g) ?? [];
  return [...new Set(found.map((t) => t.slice(1).toLowerCase()))];
}

/** The name without its tags, as the list shows it beside the tag chips. */
export function plainName(name: string): string {
  return name.replace(/\s*#[^\s#]+/g, "").trim() || name;
}

/** Every tag of the list with how many projects have it, the most used first. */
export function allTags(projects: readonly StoreProjectSummary[]): { tag: string; count: number }[] {
  const n = new Map<string, number>();
  for (const p of projects) for (const t of tagsOf(p.name)) n.set(t, (n.get(t) ?? 0) + 1);
  return [...n.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export interface ProjectFilter {
  query: string;
  tag: string;
  mine: boolean;
  /** Who is signed in, for `mine`. */
  me: string;
}

/** The search of the list: the words of the query must all be in the name, the id or the owner (any letter case); the tag and "mine" narrow it more. */
export function filterProjects(list: readonly StoreProjectSummary[], f: ProjectFilter): StoreProjectSummary[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter((p) => {
    const hay = `${p.name} ${p.id} ${p.owner}`.toLowerCase();
    if (!words.every((w) => hay.includes(w))) return false;
    if (f.tag && !tagsOf(p.name).includes(f.tag.toLowerCase())) return false;
    if (f.mine && p.owner !== f.me) return false;
    return true;
  });
}

export type ProjectOrder = "updated" | "name" | "files";

export function sortProjects(list: readonly StoreProjectSummary[], order: ProjectOrder): StoreProjectSummary[] {
  const copy = [...list];
  if (order === "name") copy.sort((a, b) => a.name.localeCompare(b.name));
  else if (order === "files") copy.sort((a, b) => (b.files ?? 0) - (a.files ?? 0) || a.name.localeCompare(b.name));
  else copy.sort((a, b) => (b.updated ?? 0) - (a.updated ?? 0) || a.name.localeCompare(b.name));
  return copy;
}

// ---- the tree of the files

export interface TreeNode {
  /** The path from the root (`layers/top.gbr`; a folder ends without a slash). */
  path: string;
  name: string;
  depth: number;
  folder: boolean;
  /** For a file: its size. For a folder: the sum of what it holds. */
  size: number;
  /** For a folder: how many files it holds in all. */
  count: number;
  file?: StoreFile;
  children: TreeNode[];
}

/** The tree of a project from the flat list of its files: the folders first, each side in alphabetical order. */
export function buildTree(files: readonly StoreFile[]): TreeNode[] {
  const root: TreeNode = { path: "", name: "", depth: -1, folder: true, size: 0, count: 0, children: [] };
  for (const f of files) {
    const parts = f.name.split("/");
    let at = root;
    for (let i = 0; i < parts.length; i++) {
      const last = i === parts.length - 1;
      const path = parts.slice(0, i + 1).join("/");
      let next = at.children.find((c) => c.path === path && c.folder === !last);
      if (!next) {
        next = { path, name: parts[i], depth: i, folder: !last, size: 0, count: 0, children: [] };
        at.children.push(next);
      }
      next.size += f.size;
      next.count += 1;
      if (last) next.file = f;
      at = next;
    }
  }
  const order = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => (a.folder === b.folder ? a.name.localeCompare(b.name) : a.folder ? -1 : 1));
    for (const n of nodes) order(n.children);
  };
  order(root.children);
  return root.children;
}

/** The rows of the tree that are in view, in order, without the contents of the folders that are collapsed. */
export function visibleRows(nodes: readonly TreeNode[], collapsed: ReadonlySet<string>): TreeNode[] {
  const out: TreeNode[] = [];
  const walk = (list: readonly TreeNode[]) => {
    for (const n of list) {
      out.push(n);
      if (n.folder && !collapsed.has(n.path)) walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

// ---- the lock

export type LockView = { state: "free" } | { state: "mine" | "other"; holder: string; remainingS: number };

/** Who holds the project and for how long yet; a lock whose time has passed is free (the server drops it by itself). */
export function lockView(lock: StoreLock | null | undefined, me: string, nowS: number): LockView {
  if (!lock || lock.expires <= nowS) return { state: "free" };
  return { state: lock.holder === me ? "mine" : "other", holder: lock.holder, remainingS: Math.max(0, Math.floor(lock.expires - nowS)) };
}

/** The time left of a lock as `m:ss` (or `h:mm:ss` from an hour). */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const two = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${two(m)}:${two(r)}` : `${m}:${two(r)}`;
}

/** A lock about to end (a tenth of the time it was taken for, or one minute) is marked so the person renews it. */
export function lockIsShort(lock: StoreLock, nowS: number): boolean {
  const total = lock.since !== undefined ? lock.expires - lock.since : 0;
  const left = lock.expires - nowS;
  return left <= Math.max(60, total / 10);
}

// ---- what can be shown of a file

export type PreviewKind = "image" | "text" | "binary";

const IMAGE_TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", bmp: "image/bmp", svg: "image/svg+xml" };
/** The extensions shown as text: documents and data, the files of drilling (Excellon, `.ncd`, `.dtd`), of G-code and of Gerber (and the other layers a board makes). */
const TEXT_EXTENSIONS = new Set([
  "txt", "md", "json", "csv", "tsv", "cfg", "ini", "xml", "yml", "yaml", "log", "toml",
  "gbr", "ger", "gtl", "gbl", "gts", "gbs", "gto", "gbo", "gtp", "gbp", "gko", "gm1", "gml", "g1", "g2", "g3", "g4", "gd1", "gdo", "gpt", "gpb", "gp1", "gp2",
  "drl", "xln", "exc", "ncd", "dtd", "dcf", "rcf", "pl", "plt", "hpgl",
  "nc", "gcode", "ngc", "tap", "cnc", "gc", "gco", "mpf", "eia",
  "brd", "sch", "lbr", "eh3d", "kicad_pcb", "kicad_sch", "kicad_pro", "rules", "dru",
]);

function extension(name: string): string {
  const base = name.split("/").pop() ?? name;
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot + 1).toLowerCase();
}

export function previewKind(name: string): PreviewKind {
  const ext = extension(name);
  if (ext in IMAGE_TYPES) return "image";
  if (TEXT_EXTENSIONS.has(ext)) return "text";
  return "binary";
}

export function imageType(name: string): string {
  return IMAGE_TYPES[extension(name)] ?? "application/octet-stream";
}

export function isJsonName(name: string): boolean {
  return extension(name) === "json";
}

export interface TextPreview {
  text: string;
  /** The text was cut (by characters or by lines) or the file was longer than what was downloaded. */
  truncated: boolean;
  lines: number;
  /** The bytes hold a NUL byte or are not text: they are not shown as text. */
  binary: boolean;
}

/** The text of a file within the limits of the preview. Bytes with a NUL byte in the first part are binary, not text. */
export function textPreview(bytes: Uint8Array, opts: { maxChars?: number; maxLines?: number; fileSize?: number } = {}): TextPreview {
  const maxChars = opts.maxChars ?? PREVIEW_TEXT_CHARS;
  const maxLines = opts.maxLines ?? PREVIEW_TEXT_LINES;
  const head = bytes.subarray(0, 4096);
  if (head.includes(0)) return { text: "", truncated: false, lines: 0, binary: true };
  let text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  let truncated = opts.fileSize !== undefined && opts.fileSize > bytes.length;
  const lines = text.split(/\r?\n/);
  if (lines.length > maxLines) {
    text = lines.slice(0, maxLines).join("\n");
    truncated = true;
  }
  if (text.length > maxChars) {
    text = text.slice(0, maxChars);
    truncated = true;
  }
  return { text, truncated, lines: Math.min(lines.length, maxLines), binary: false };
}

/** Pretty-prints a JSON text for the preview; a text that is not JSON is left as it is. */
export function prettyJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

// ---- sizes

export function bytesText(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function totalBytes(files: readonly StoreFile[]): number {
  return files.reduce((a, f) => a + f.size, 0);
}

/** The name of the file of an export or a download: letters, digits, dot, underscore and hyphen. */
export function downloadName(name: string, extra = ""): string {
  const clean = (name.split("/").pop() ?? name).replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "project";
  return clean + extra;
}

// ---- the name of a file, checked before it is sent (the server applies the strict rule of the container)

/** The names that the server certainly refuses are caught on the page: empty, absolute, with a backslash or a colon, with `.` or `..` parts, empty parts, control characters or more than 240 bytes. */
export function validFileName(name: string): boolean {
  if (name === "" || name.startsWith("/") || name.includes("\\") || name.includes(":")) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(name)) return false;
  if (new TextEncoder().encode(name).length > 240) return false;
  return name.split("/").every((part) => part !== "" && part !== "." && part !== ".." && !/[. ]$/.test(part));
}

/** The folder of a name and the name of a file: `layers/top.gbr` given the folder `layers`. */
export function joinPath(folder: string, name: string): string {
  const f = folder.trim().replace(/^\/+|\/+$/g, "");
  return f ? `${f}/${name}` : name;
}
