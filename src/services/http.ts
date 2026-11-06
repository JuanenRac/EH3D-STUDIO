/*
 * The transport of the clients of the common services (project store, catalogs, plugins and jobs, single login): JSON and raw bytes with the limits that keep a page safe.
 * Every request has a time limit; a download has a size limit (checked on the header and again while it is read); an upload is refused before it is sent when it is too big;
 * and only a read (GET) is tried again, a bounded number of times, when the network fails or a gateway answers 502, 503 or 504. A refusal of the server is an ApiError with
 * its status, its code and its detail, the same as in api.ts. The token is asked for at every request, so a login that changes is followed.
 * Copyright (C) 2026 JuanenRac (Electro Hobby 3D). GPL-3.0-or-later.
 */
import { ApiError } from "../api";

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpLimits {
  /** Milliseconds for an ordinary request. */
  normal: number;
  /** Milliseconds for a request that carries or brings a file. */
  transfer: number;
  /** The most bytes a download may have. */
  maxDownload: number;
  /** The most bytes an upload may have. */
  maxUpload: number;
  /** How many times a read is tried again (0: never). */
  retries: number;
  /** The first wait before a new try, in milliseconds; each one waits one more of these. */
  retryDelayMs: number;
}

export const DEFAULT_LIMITS: HttpLimits = {
  normal: 15000,
  transfer: 60000,
  maxDownload: 32 * 1024 * 1024,
  maxUpload: 32 * 1024 * 1024,
  retries: 2,
  retryDelayMs: 400,
};

export const API_BASE = "/api/v1";

export interface Request {
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  /** A JSON body. */
  json?: unknown;
  /** A raw body. */
  bytes?: Uint8Array;
  contentType?: string;
  /** A file goes or comes: the longer time limit applies. */
  transfer?: boolean;
  /** Overrides the limit of the download for this request. */
  maxDownload?: number;
  /** Overrides the number of new tries of a read. */
  retries?: number;
}

export interface Reply {
  status: number;
  headers: Headers;
  body: Uint8Array;
}

/** The path with its query: values that are undefined, null or empty are left out. */
export function withQuery(path: string, query: Request["query"]): string {
  if (!query) return path;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "") continue;
    q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${path}${path.includes("?") ? "&" : "?"}${s}` : path;
}

/** The tag of a version as the `If-Match` header carries it: between quotes. */
export function quoteTag(sha: string): string {
  return `"${sha.replace(/^W\//, "").replace(/"/g, "")}"`;
}

/** The tag of an `ETag` header without its quotes. */
export function unquoteTag(tag: string | null): string | null {
  if (tag === null) return null;
  return tag.replace(/^W\//, "").replace(/^"|"$/g, "");
}

function failure(status: number, body: Uint8Array): ApiError {
  let data: { error?: string; detail?: string } = {};
  try {
    data = JSON.parse(new TextDecoder().decode(body)) as typeof data;
  } catch {
    data = {};
  }
  return new ApiError(status, data.error ?? `http_${status}`, data.detail ?? "");
}

/** Reads the body of a response up to `max` bytes; a longer one is cancelled and ends as the error `download_too_big`. */
export async function readLimited(r: Response, max: number): Promise<Uint8Array> {
  const declared = Number(r.headers.get("content-length"));
  if (r.headers.get("content-length") !== null && Number.isFinite(declared) && declared > max) {
    try {
      await r.body?.cancel();
    } catch {
      /* nothing to cancel */
    }
    throw new ApiError(0, "download_too_big", String(max));
  }
  if (!r.body) {
    const all = new Uint8Array(await r.arrayBuffer());
    if (all.length > max) throw new ApiError(0, "download_too_big", String(max));
    return all;
  }
  const reader = r.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw new ApiError(0, "download_too_big", String(max));
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

const RETRYABLE = new Set([502, 503, 504]);

export class ServiceHttp {
  private limits: HttpLimits;

  constructor(
    private token: () => string | null,
    private fetcher: Fetcher,
    limits: Partial<HttpLimits> = {},
    private sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  /** One try: the request, the time limit, the body read within the limit. */
  private async attempt(method: string, path: string, req: Request): Promise<Reply> {
    const headers: Record<string, string> = { ...(req.headers ?? {}) };
    const token = this.token();
    if (token) headers.authorization = `Bearer ${token}`;
    let body: BodyInit | undefined;
    if (req.bytes !== undefined) {
      if (req.bytes.length > this.limits.maxUpload) throw new ApiError(0, "upload_too_big", String(this.limits.maxUpload));
      headers["content-type"] = req.contentType ?? "application/octet-stream";
      body = req.bytes as unknown as BodyInit;
    } else if (req.json !== undefined) {
      headers["content-type"] = "application/json";
      body = JSON.stringify(req.json);
    }
    const limit = req.transfer ? this.limits.transfer : this.limits.normal;
    const max = req.maxDownload ?? this.limits.maxDownload;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ApiError(0, "timeout", `${limit} ms`));
      }, limit);
    });
    try {
      const answer = async (): Promise<Reply> => {
        const r = await this.fetcher(API_BASE + withQuery(path, req.query), { method, headers, body, signal: controller.signal });
        const bytes = await readLimited(r, max);
        return { status: r.status, headers: r.headers, body: bytes };
      };
      const reply = await Promise.race([answer(), late]);
      if (reply.status >= 400) throw failure(reply.status, reply.body);
      return reply;
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(0, controller.signal.aborted ? "timeout" : "unreachable", e instanceof Error ? e.message : String(e));
    } finally {
      clearTimeout(timer);
    }
  }

  /** The request with the new tries of a read: the network that fails, the time that runs out and a gateway that is not ready are tried again; a refusal is not. */
  async send(method: string, path: string, req: Request = {}): Promise<Reply> {
    const tries = method === "GET" ? (req.retries ?? this.limits.retries) : 0;
    for (let n = 0; ; n++) {
      try {
        return await this.attempt(method, path, req);
      } catch (e) {
        const again = e instanceof ApiError && (e.code === "unreachable" || e.code === "timeout" || RETRYABLE.has(e.status));
        if (!again || n >= tries) throw e;
        await this.sleep(this.limits.retryDelayMs * (n + 1));
      }
    }
  }

  /** The answer as JSON (null for an empty body). */
  async json<T>(method: string, path: string, req: Request = {}): Promise<T> {
    const r = await this.send(method, path, req);
    return this.parse<T>(r);
  }

  /** The answer as JSON together with the `ETag` header. */
  async jsonWithTag<T>(method: string, path: string, req: Request = {}): Promise<{ data: T; etag: string | null }> {
    const r = await this.send(method, path, req);
    return { data: this.parse<T>(r), etag: unquoteTag(r.headers.get("etag")) };
  }

  private parse<T>(r: Reply): T {
    if (r.body.length === 0) return null as T;
    try {
      return JSON.parse(new TextDecoder().decode(r.body)) as T;
    } catch {
      return null as T;
    }
  }
}
