/*
 * The attachments of an `.eh3d` project, read in the browser from the file a person chooses (docs/FORMAT_EH3D.md of EH3D-COMMON): a ZIP with `attachments/index.json` and the bytes under
 * `attachments/blobs/<sha256>/00000, 00001...`. Only the parts that are asked for are read from the file, nothing is sent anywhere and nothing is run: text and pictures are shown, any
 * other kind can only be saved as a copy. GPL-3.0-or-later.
 */

export type Eh3dProblem = "not_zip" | "unsupported" | "damaged" | "too_large";

export class Eh3dError extends Error {
  constructor(public problem: Eh3dProblem) {
    super(problem);
  }
}

interface Entry {
  method: number;
  packed: number;
  size: number;
  offset: number;
}

/** The most the viewer takes into memory: the index, a text or a picture it shows, a copy it saves. */
export const LIMITS = { index: 8 * 1024 * 1024, text: 1024 * 1024, image: 32 * 1024 * 1024, save: 256 * 1024 * 1024 };
const MOST_ENTRIES = 60000;

async function bytesOf(file: Blob, from: number, to: number): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(from, to).arrayBuffer());
}

const u16 = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);
const u32 = (b: Uint8Array, at: number) => (u16(b, at) | (u16(b, at + 2) << 16)) >>> 0;

/** The entries of the central directory of a ZIP. */
export async function entriesOf(file: Blob): Promise<Map<string, Entry>> {
  const tailStart = Math.max(0, file.size - 65557);
  const tail = await bytesOf(file, tailStart, file.size);
  let end = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tail, i) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Eh3dError("not_zip");
  const count = u16(tail, end + 10);
  const length = u32(tail, end + 12);
  const start = u32(tail, end + 16);
  if (count === 0xffff || start === 0xffffffff || count > MOST_ENTRIES) throw new Eh3dError("unsupported");
  if (start + length > file.size) throw new Eh3dError("damaged");
  const dir = await bytesOf(file, start, start + length);
  const out = new Map<string, Entry>();
  let at = 0;
  for (let n = 0; n < count; n++) {
    if (at + 46 > dir.length || u32(dir, at) !== 0x02014b50) throw new Eh3dError("damaged");
    const nameLength = u16(dir, at + 28);
    const name = new TextDecoder().decode(dir.subarray(at + 46, at + 46 + nameLength));
    out.set(name, { method: u16(dir, at + 10), packed: u32(dir, at + 20), size: u32(dir, at + 24), offset: u32(dir, at + 42) });
    at += 46 + nameLength + u16(dir, at + 30) + u16(dir, at + 32);
  }
  return out;
}

/** The content of an entry, never more than it says it has (a file that unpacks to more is refused). */
export async function readEntry(file: Blob, entry: Entry, most: number): Promise<Uint8Array> {
  if (entry.size > most) throw new Eh3dError("too_large");
  const head = await bytesOf(file, entry.offset, entry.offset + 30);
  if (head.length < 30 || u32(head, 0) !== 0x04034b50) throw new Eh3dError("damaged");
  const from = entry.offset + 30 + u16(head, 26) + u16(head, 28);
  const packed = await bytesOf(file, from, from + entry.packed);
  if (packed.length !== entry.packed) throw new Eh3dError("damaged");
  if (entry.method === 0) {
    if (packed.length !== entry.size) throw new Eh3dError("damaged");
    return packed;
  }
  if (entry.method !== 8) throw new Eh3dError("unsupported");
  const out = new Uint8Array(entry.size);
  let at = 0;
  try {
    const source = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(packed);
        c.close();
      },
    });
    const reader = source.pipeThrough(new DecompressionStream("deflate-raw") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>).getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (at + value.length > out.length) {
        await reader.cancel();
        throw new Eh3dError("damaged");
      }
      out.set(value, at);
      at += value.length;
    }
  } catch (e) {
    throw e instanceof Eh3dError ? e : new Eh3dError("damaged");
  }
  if (at !== entry.size) throw new Eh3dError("damaged");
  return out;
}

export interface Attachment {
  sha256: string;
  name: string;
  size: number;
  kind: string;
  /** The address of a file that is not inside, to be shown and never opened by itself. */
  url: string | null;
  components: string[];
  /** A program, a script, an office file with macros, an archive, a page that can run code or a kind nobody knows: saving it asks first. */
  asks: boolean;
}

export interface Project {
  file: Blob;
  entries: Map<string, Entry>;
  attachments: Attachment[];
}

const KINDS = ["pdf", "markdown", "text", "image", "report", "office", "project", "cad", "video", "audio", "archive"];
const RUNS = /\.(exe|msi|com|scr|dll|bat|cmd|ps1|vbs|js|jar|sh|py|pl|rb|lnk|reg|hta|html?|xhtml|svgz?|xml|docm|xlsm|pptm|zip|7z|rar|gz|tar|iso|apk|app|dmg|deb|rpm)$/i;

/** A name safe to save under: no folder, no control or text-reordering character, no leading dot or dash. */
export function safeName(name: string): string {
  const clean = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2060-\u2069\ufeff<>:"/\\|?*]/g, "_")
    .replace(/^[\s.-]+|[\s.]+$/g, "")
    .slice(0, 150);
  if (clean === "" || /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(clean)) return "attachment";
  return clean;
}

function readIndex(text: string): Attachment[] {
  let index: unknown;
  try {
    index = JSON.parse(text);
  } catch {
    throw new Eh3dError("damaged");
  }
  const o = index as { schema?: unknown; attachments?: unknown };
  if (typeof o !== "object" || o === null || !Array.isArray(o.attachments)) throw new Eh3dError("damaged");
  if (o.schema !== 1) throw new Eh3dError("unsupported");
  const out: Attachment[] = [];
  for (const raw of o.attachments as Record<string, unknown>[]) {
    if (typeof raw !== "object" || raw === null || typeof raw.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(raw.sha256)) continue;
    const name = safeName(typeof raw.name === "string" ? raw.name : "");
    const kind = typeof raw.kind === "string" && KINDS.includes(raw.kind) ? raw.kind : "other";
    const parts = Array.isArray(raw.components) ? (raw.components as Record<string, unknown>[]) : [];
    out.push({
      sha256: raw.sha256,
      name,
      size: typeof raw.size === "number" && raw.size >= 0 ? raw.size : 0,
      kind,
      url: raw.storage === "link" && typeof raw.url === "string" ? raw.url : null,
      components: parts.map((c) => [c?.reference, c?.value, c?.manufacturer, c?.part_number].filter((x) => typeof x === "string").join(" ")).filter((s) => s !== ""),
      asks: kind === "other" || kind === "archive" || typeof raw.danger === "string" || RUNS.test(name),
    });
  }
  return out;
}

export async function openProject(file: Blob): Promise<Project> {
  const entries = await entriesOf(file);
  if (!entries.has("project.json")) throw new Eh3dError("not_zip");
  const index = entries.get("attachments/index.json");
  const attachments = index ? readIndex(new TextDecoder().decode(await readEntry(file, index, LIMITS.index))) : [];
  return { file, entries, attachments };
}

export interface Content {
  bytes: Uint8Array;
  /** The content has the SHA-256 the index says; null where the browser cannot tell (a page not served over HTTPS). */
  verified: boolean | null;
}

/** The bytes of an attachment that is inside the file. */
export async function readAttachment(p: Project, a: Attachment, most: number): Promise<Content> {
  const parts: Entry[] = [];
  for (let n = 0; ; n++) {
    const e = p.entries.get(`attachments/blobs/${a.sha256}/${String(n).padStart(5, "0")}`);
    if (!e) break;
    parts.push(e);
  }
  const size = parts.reduce((s, e) => s + e.size, 0);
  if (parts.length === 0 || size !== a.size) throw new Eh3dError("damaged");
  if (size > most) throw new Eh3dError("too_large");
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const e of parts) {
    bytes.set(await readEntry(p.file, e, most), at);
    at += e.size;
  }
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return { bytes, verified: null };
  const digest = new Uint8Array(await subtle.digest("SHA-256", bytes as unknown as BufferSource));
  const hex = Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  if (hex !== a.sha256) throw new Eh3dError("damaged");
  return { bytes, verified: true };
}

/** The type of a picture the browser can show without running anything, told by its first bytes; null for anything else (SVG among them). */
export function pictureType(b: Uint8Array): string | null {
  const starts = (...x: number[]) => x.every((v, i) => b[i] === v);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x42, 0x4d)) return "image/bmp";
  if (starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return null;
}

/** How an attachment is shown: as text, as a picture or not at all. */
export function viewOf(a: Attachment): "text" | "image" | "none" {
  if (a.url !== null) return "none";
  if (a.kind === "image" && !/\.svgz?$/i.test(a.name)) return "image";
  if (a.kind === "text" || a.kind === "markdown" || a.kind === "report") return "text";
  return "none";
}
