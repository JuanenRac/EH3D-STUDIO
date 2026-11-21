/*
 * The settings of the server drawn from its contract (`GET /api/v1/settings/contract`, docs/settings-contract.json and docs/CLIENT_SYNC.md of EH3D-SERVER). The server lists every
 * key of `server.cfg` with its group, type, range, default, unit, whether a change applies at once or after a restart, the route that writes it, the role and scope it needs,
 * whether it is a secret, its risk and its label, help and warning in eight languages. Studio keeps a copy of that file (src/data/settings-contract.json, checked by
 * tools/sync_settings_contract.py) for when the live one cannot be read; the page then shows it read-only. Nothing here holds a secret: the value of a secret key is never
 * asked for, shown or written. GPL-3.0-or-later.
 */
import type { Lang } from "../i18n";
import { VARIANT_OF } from "../i18n";
import { atLeast } from "../model";
import type { Role } from "../types";
import type { Who } from "./permissions";
import type { ServiceHttp } from "./http";
import { API_BASE } from "./http";
import { CONTRACT_COPY_HASH } from "./contracthash";

/** The version of the document that Studio understands. */
export const CONTRACT_SCHEMA = "eh3d.settings.contract/1";

/** The languages of the texts of the contract; every other language of Studio reads the English text (a variant reads its main language). */
export const CONTRACT_LANGS = ["en", "es", "de", "fr", "it", "ja", "zh", "pt"] as const;
export type ContractLang = (typeof CONTRACT_LANGS)[number];

export type Localized = Partial<Record<string, string>>;

export interface ContractGroup {
  id: string;
  label: Localized;
}

export interface SettingWrite {
  via: "policy" | "file" | string;
  method?: string | null;
  path?: string | null;
  file?: string;
}

export interface Setting {
  key: string;
  group: string;
  /** `boolean`, `integer`, `string`, `enum` or `list`; anything else is drawn with the generic control. */
  type: string;
  default: unknown;
  apply: "now" | "restart" | string;
  write: SettingWrite;
  role: string | null;
  scope: string | null;
  confirm_when_looser: boolean;
  secret: boolean;
  risk: string;
  min?: number;
  max?: number;
  unit?: string;
  max_length?: number;
  format?: string;
  /** The choices of an `enum`. */
  values?: unknown[];
  label: Localized;
  help: Localized;
  warning: Localized;
}

export interface SettingsContract {
  schema: string;
  languages: string[];
  groups: ContractGroup[];
  settings: Setting[];
}

/** The answer of `GET /api/v1/settings/contract`: the contract and the values in force. */
export interface LiveContract extends SettingsContract {
  values?: Record<string, unknown>;
  server_version?: string;
  /** The SHA-256 of the contract document of the server (line ends as LF). */
  contract_hash?: string;
}

/** Whether the contract of the server is the copy Studio keeps: its `contract_hash` against the hash of the copy (`unknown`: the server gave none, or one that is not a SHA-256). */
export type HashState = "same" | "differs" | "unknown";

/**
 * The contract as the page holds it: where it came from (`live`: the full contract of an administrator; `light`: the values of `GET /settings/values`, any login, with the texts of the copy;
 * `embedded`: the copy alone), the values in force (none for the copy) and why the live one could not be used.
 */
export interface LoadedContract {
  contract: SettingsContract;
  source: "live" | "light" | "embedded";
  /** The values in force. Never holds a secret or a key the server keeps back. */
  values: Record<string, unknown>;
  serverVersion: string | null;
  /** The reason the live contract was not used (a code of the server, `schema` or `shape`); null for a live contract. */
  why: string | null;
  /** Whether the contract of the server is the copy Studio keeps; absent for the copy alone. */
  hash?: HashState;
  /** Light view: keys the server marks secret (no value is ever kept), keys it keeps back (a path of the computer), values it cut, and keys changed through the security page. */
  secretKeys?: string[];
  hidden?: string[];
  truncated?: string[];
  overridden?: string[];
}

/** The hash of the copy of the contract that Studio keeps. */
export const COPY_HASH = CONTRACT_COPY_HASH;

/** A SHA-256 as the server writes it: 64 lower-case hexadecimal characters. */
export function isSha256(x: unknown): x is string {
  return typeof x === "string" && /^[0-9a-f]{64}$/.test(x);
}

/** The `contract_hash` of the server against the hash of the copy. */
export function compareHash(serverHash: unknown): HashState {
  if (!isSha256(serverHash)) return "unknown";
  return serverHash === COPY_HASH ? "same" : "differs";
}

/** Whether a document is a contract that Studio can draw: the schema it knows, a list of groups and a list of settings, each with a key. */
export function isContract(x: unknown): x is SettingsContract {
  if (typeof x !== "object" || x === null) return false;
  const d = x as Partial<SettingsContract>;
  if (d.schema !== CONTRACT_SCHEMA) return false;
  if (!Array.isArray(d.groups) || !Array.isArray(d.settings)) return false;
  return d.settings.every((s) => typeof s === "object" && s !== null && typeof (s as Setting).key === "string" && typeof (s as Setting).write === "object");
}

/** The text of a field of the contract in the language of the person: the language itself, its main language (pt-br reads pt), English, then any text there is. */
export function contractText(map: Localized | undefined, lang: Lang): string {
  if (!map) return "";
  const main = VARIANT_OF[lang];
  return map[lang] ?? (main ? map[main] : undefined) ?? map.en ?? Object.values(map).find((v) => typeof v === "string" && v !== "") ?? "";
}

/** One group of the page: its id, its label (the id when the contract has none) and its settings in the order of the contract. */
export interface SettingsGroup {
  id: string;
  label: Localized;
  settings: Setting[];
}

/**
 * The groups of the page, in the order of the contract. A setting whose group the contract does not list (a newer server) goes into a group made from that id, after the
 * others, so it is never hidden.
 */
export function groupSettings(contract: SettingsContract): SettingsGroup[] {
  const out: SettingsGroup[] = contract.groups.map((g) => ({ id: g.id, label: g.label, settings: [] }));
  for (const s of contract.settings) {
    let g = out.find((x) => x.id === s.group);
    if (!g) {
      g = { id: s.group, label: { en: s.group }, settings: [] };
      out.push(g);
    }
    g.settings.push(s);
  }
  return out.filter((g) => g.settings.length > 0);
}

/**
 * The settings that the server reports a value for but that the contract does not list (a key newer than both the server's contract and Studio's copy): they are drawn read-only
 * with the generic control, so nothing the server holds is hidden and nothing breaks.
 */
export function unlistedSettings(contract: SettingsContract, values: Record<string, unknown>, kept: readonly string[] = []): Setting[] {
  const known = new Set(contract.settings.map((s) => s.key));
  const keys = [...new Set([...Object.keys(values), ...kept])].filter((k) => !known.has(k)).sort();
  return keys.map((key) => genericSetting(key, values[key]));
}

/** A setting made for a key nobody described: no label but its name, nothing the person may change. */
export function genericSetting(key: string, value: unknown): Setting {
  return {
    key,
    group: "other",
    type: typeof value === "boolean" ? "boolean" : typeof value === "number" ? "integer" : "unknown",
    default: null,
    apply: "restart",
    write: { via: "none" },
    role: null,
    scope: null,
    confirm_when_looser: false,
    secret: false,
    risk: "none",
    label: { en: key },
    help: {},
    warning: {},
  };
}

/** The kind of control a setting is drawn with. Everything the page does not know how to edit is `generic`: a read-only line with the value as the server gives it. */
export type ControlKind = "switch" | "number" | "text" | "select" | "list" | "generic";

export function controlKind(s: Setting): ControlKind {
  switch (s.type) {
    case "boolean":
      return "switch";
    case "integer":
      return typeof s.min === "number" && typeof s.max === "number" ? "number" : "text";
    case "string":
      return "text";
    case "enum":
      return Array.isArray(s.values) && s.values.length > 0 ? "select" : "text";
    case "list":
      return "list";
    default:
      return "generic";
  }
}

/** Whether a change of this setting needs the second touch: its risk is one that can open the server, weaken the security or touch a machine or data. */
export function isHighRisk(s: Setting): boolean {
  return s.risk === "security" || s.risk === "exposure" || s.risk === "machine" || s.risk === "data";
}

/** Whether this person may change the setting through the API: the contract names a route for it, it is no secret, the role is enough and a token's scope (if it has scopes) includes the one the setting needs. */
export function canWrite(who: Who | null | undefined, s: Setting): boolean {
  if (!who || s.secret || s.write.via !== "policy" || !s.write.method || !s.write.path) return false;
  if (s.role && !atLeast(who.role, s.role as Role)) return false;
  if (s.scope && who.scopes != null && !who.scopes.includes(s.scope)) return false;
  return controlKind(s) !== "generic";
}

/** The route of the contract without the base that the transport adds. */
export function writePath(s: Setting): string {
  const path = s.write.path ?? "";
  return path.startsWith(API_BASE) ? path.slice(API_BASE.length) : path;
}

/** The value of a setting as it is in force: the live value, else nothing (a copy of the contract knows no values). A secret has none. */
export function valueOf(s: Setting, values: Record<string, unknown>): unknown {
  if (s.secret) return undefined;
  return Object.prototype.hasOwnProperty.call(values, s.key) ? values[s.key] : undefined;
}

/** Two values are the same when they print the same (a list is compared by its items). */
export function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

/** A value as the page writes it in a line: `on`/`off` are the page's job, here a list is `a, b`, empty is an empty string and the rest is JSON. */
export function shownValue(v: unknown): string {
  if (v === undefined || v === null) return "";
  if (Array.isArray(v)) return v.map((x) => String(x)).join(", ");
  if (typeof v === "string") return v;
  return typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** What a person typed for a setting and why it is wrong: `{ ok: true, value }` with the value to send, or `{ ok: false, problem }` naming what the client found. */
export type Typed = { ok: true; value: unknown } | { ok: false; problem: "number" | "text" | "choice" };

/** Checks what was typed against the contract before anything is sent: the type, the range of a number, the length of a text and the choices of an enum. */
export function parseTyped(s: Setting, text: string): Typed {
  switch (controlKind(s)) {
    case "number": {
      if (!/^-?\d{1,15}$/.test(text.trim())) return { ok: false, problem: "number" };
      const n = Number(text.trim());
      if (n < (s.min as number) || n > (s.max as number)) return { ok: false, problem: "number" };
      return { ok: true, value: n };
    }
    case "text": {
      if (s.type === "integer") {
        // an integer with no range in the contract: still a whole number
        return /^-?\d{1,15}$/.test(text.trim()) ? { ok: true, value: Number(text.trim()) } : { ok: false, problem: "number" };
      }
      if (typeof s.max_length === "number" && text.length > s.max_length) return { ok: false, problem: "text" };
      return { ok: true, value: text };
    }
    case "select": {
      const found = (s.values ?? []).find((v) => String(v) === text);
      return found === undefined ? { ok: false, problem: "choice" } : { ok: true, value: found };
    }
    case "list": {
      const items = text
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x !== "");
      return { ok: true, value: items };
    }
    default:
      return { ok: false, problem: "text" };
  }
}

/** The answer of a write: the policy and, in `changed`, what the server did with the key. */
export interface WriteAnswer {
  changed?: { key: string; from?: unknown; to?: unknown; apply?: string; restart_required?: boolean };
}

/** Writes a setting by the method and the route its entry of the contract names. A looser value than recommended is sent with `confirm_weak`. */
export async function writeSetting(http: ServiceHttp, s: Setting, value: unknown, confirmWeak = false): Promise<WriteAnswer> {
  if (!canWrite({ role: "admin", scopes: null }, s)) throw new Error(`${s.key} is not written through the API`);
  const json: Record<string, unknown> = { key: s.key, value };
  if (confirmWeak) json.confirm_weak = true;
  return http.json<WriteAnswer>((s.write.method ?? "PUT").toUpperCase(), writePath(s), { json });
}

/** Reads the live contract. */
export function readContract(http: ServiceHttp): Promise<LiveContract> {
  return http.json<LiveContract>("GET", "/settings/contract");
}

// ---- the light view of the values in force (GET /api/v1/settings/values) ---------------------------------------------------------------------------

/** The version of the light answer that Studio understands (`eh3d.settings.values/2` would be a newer one: Studio says so and shows its copy). */
export const LIGHT_SCHEMA = "eh3d.settings.values/1";
export const LIGHT_PATH = "/settings/values";
/** The server never sends more than this of the light view; Studio refuses to read more. */
export const LIGHT_MAX_BYTES = 16 * 1024;
/** What Studio accepts of one answer: more keys, a longer text or a longer list is a document it does not trust. */
export const LIGHT_MAX_KEYS = 256;
export const LIGHT_MAX_TEXT = 1024;
export const LIGHT_MAX_ITEMS = 64;
/** How often the page asks again for the light view, in seconds (an answer with the same ETag is a few bytes); the pages that poll may use their own refresh time if it is longer. */
export const LIGHT_POLL_S = 30;
/** What stands in the place of the value of a secret key. */
export const SECRET_MARK = "***";

/** One key of the light answer. */
export interface LightEntry {
  /** The value in force; absent for a secret, a key kept back, a null. */
  value?: unknown;
  secret: boolean;
  hidden: boolean;
  truncated: boolean;
  /** `origin` is `override`: changed through the security page, differs from server.cfg. */
  overridden: boolean;
  editable: boolean;
}

export interface LightValues {
  serverVersion: string | null;
  /** Empty when the server gave none or one that is not a SHA-256. */
  contractHash: string | null;
  entries: Record<string, LightEntry>;
}

const KEY_NAME = /^[a-z0-9_]{1,48}$/;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function plain(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

/**
 * Reads the answer of `GET /settings/values`. Nothing half-understood is kept: a key that is not a name of lower-case letters, digits and underscores (or is one that would touch the
 * prototype), an entry that is not an object, a value that is an object, a text or list longer than Studio accepts, more than `LIGHT_MAX_KEYS` keys or a `count` that is not the number of
 * keys make the whole answer malformed (`shape`); another schema of the same family is `newer`. A secret (`secret: true`, or the mark `***` as a value) and a key kept back (`hidden`)
 * never have a value, whatever the server sent in its place.
 */
export function parseLight(x: unknown): LightValues | "newer" | "shape" {
  if (!plain(x)) return "shape";
  if (x.schema !== LIGHT_SCHEMA) return typeof x.schema === "string" && x.schema.startsWith("eh3d.settings.values/") ? "newer" : "shape";
  const settings = x.settings;
  if (!plain(settings)) return "shape";
  const keys = Object.keys(settings);
  if (keys.length > LIGHT_MAX_KEYS) return "shape";
  if (x.count !== undefined && x.count !== keys.length) return "shape";
  const entries: Record<string, LightEntry> = Object.create(null) as Record<string, LightEntry>;
  for (const key of keys) {
    const o = settings[key];
    if (!KEY_NAME.test(key) || UNSAFE_KEYS.has(key) || !plain(o)) return "shape";
    const entry: LightEntry = { secret: o.secret === true, hidden: o.hidden === true, truncated: o.truncated === true, overridden: o.origin === "override", editable: o.editable === true };
    const v = o.v;
    if (v === SECRET_MARK) entry.secret = true;
    if (v !== undefined && v !== null && !entry.secret && !entry.hidden) {
      if (plain(v)) return "shape";
      if (typeof v === "string") {
        if (v.length > LIGHT_MAX_TEXT) return "shape";
      } else if (Array.isArray(v)) {
        if (v.length > LIGHT_MAX_ITEMS) return "shape";
        for (const item of v) if (plain(item) || Array.isArray(item) || (typeof item === "string" && item.length > LIGHT_MAX_TEXT)) return "shape";
      } else if (typeof v !== "boolean" && !(typeof v === "number" && Number.isFinite(v))) {
        return "shape";
      }
      entry.value = v;
    }
    entries[key] = entry;
  }
  const version = typeof x.server_version === "string" && x.server_version.length <= 32 ? x.server_version : null;
  return { serverVersion: version, contractHash: isSha256(x.contract_hash) ? x.contract_hash : null, entries };
}

/** What the page uses for a light answer: the copy of Studio for the texts and the values of the answer. */
export function loadedFromLight(light: LightValues, embedded: SettingsContract): LoadedContract {
  const values: Record<string, unknown> = {};
  const secretKeys: string[] = [];
  const hidden: string[] = [];
  const truncated: string[] = [];
  const overridden: string[] = [];
  for (const key of Object.keys(light.entries).sort()) {
    const e = light.entries[key];
    if (e.secret) secretKeys.push(key);
    else if (e.hidden) hidden.push(key);
    else if (e.value !== undefined) Object.defineProperty(values, key, { value: e.value, enumerable: true, writable: true, configurable: true });
    if (e.truncated && !e.secret && !e.hidden) truncated.push(key);
    if (e.overridden && !e.secret) overridden.push(key);
  }
  return { contract: embedded, source: "light", values, serverVersion: light.serverVersion, why: null, hash: compareHash(light.contractHash), secretKeys, hidden, truncated, overridden };
}

/** The reply to a request for the light view: a new answer with its ETag, or `304` (nothing changed since the tag that was sent). */
export type LightReply = { status: 200; body: unknown; etag: string | null } | { status: 304 };

/** Asks for the light view with the ETag of the last answer in `If-None-Match`; an answer longer than `LIGHT_MAX_BYTES` ends as the error `download_too_big`. */
export async function readLight(http: ServiceHttp, etag: string | null): Promise<LightReply> {
  const r = await http.send("GET", LIGHT_PATH, { headers: etag ? { "if-none-match": etag } : {}, maxDownload: LIGHT_MAX_BYTES });
  if (r.status === 304) return { status: 304 };
  let body: unknown = null;
  try {
    body = JSON.parse(new TextDecoder().decode(r.body));
  } catch {
    body = null;
  }
  const tag = r.headers.get("etag");
  return { status: 200, body, etag: tag !== null && /^(W\/)?"[\x21\x23-\x7e]{1,96}"$/.test(tag) ? tag : null };
}

/** The last light answer and its ETag: the next request carries the tag, and a `304` gives the answer back with nothing to read. A failure forgets it. */
export class LightCache {
  etag: string | null = null;
  last: LoadedContract | null = null;
  clear(): void {
    this.etag = null;
    this.last = null;
  }
}

function codeOf(e: unknown): string {
  return typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "unreachable";
}

/** How the page asks the server: the full contract (an administrator) and the light view. Given so that a test can stand in for the server. */
export interface SettingsReaders {
  full: () => Promise<unknown>;
  light: (etag: string | null) => Promise<LightReply>;
}

/** What a round of reading the settings gave: the page's data and whether it is new (false: the server said `304`, what the page shows is still right). */
export interface SettingsRead {
  loaded: LoadedContract;
  changed: boolean;
}

/**
 * One round of reading the settings of the server for a login of `role`. An administrator asks for the full contract first (it holds the texts and the values); anybody else, and an
 * administrator whose full contract could not be read (a token without the scope of the policy), asks for the light view, with the tag of the last answer. The copy of Studio is what
 * remains, with the reason. A login that is not an administrator never asks for the full contract: the server would refuse it.
 */
export async function loadSettings(role: string | null | undefined, readers: SettingsReaders, embedded: SettingsContract, cache: LightCache): Promise<SettingsRead> {
  if (role === "admin") {
    const full = await loadContract(readers.full, embedded);
    if (full.source === "live") {
      cache.clear();
      return { loaded: full, changed: true };
    }
  }
  try {
    const reply = await readers.light(cache.etag);
    if (reply.status === 304) {
      if (cache.last) return { loaded: cache.last, changed: false };
      return { loaded: { contract: embedded, source: "embedded", values: {}, serverVersion: null, why: "shape" }, changed: true }; // a 304 for a tag nobody sent
    }
    const parsed = parseLight(reply.body);
    if (typeof parsed === "string") {
      cache.clear();
      return { loaded: { contract: embedded, source: "embedded", values: {}, serverVersion: null, why: parsed }, changed: true };
    }
    const loaded = loadedFromLight(parsed, embedded);
    cache.etag = reply.etag;
    cache.last = reply.etag ? loaded : null;
    return { loaded, changed: true };
  } catch (e) {
    cache.clear();
    return { loaded: { contract: embedded, source: "embedded", values: {}, serverVersion: null, why: codeOf(e) }, changed: true };
  }
}

/**
 * The contract the page uses: the live one when the server gives it and Studio understands it; otherwise the copy kept in Studio (read-only, without values) and the reason.
 * `read` and `embedded` are given so a test can stand in for the server and for the file.
 */
export async function loadContract(read: () => Promise<unknown>, embedded: SettingsContract): Promise<LoadedContract> {
  try {
    const live = await read();
    if (!isContract(live)) return { contract: embedded, source: "embedded", values: {}, serverVersion: null, why: "shape" };
    const values = (live as LiveContract).values;
    const version = (live as LiveContract).server_version;
    const hash = (live as LiveContract).contract_hash;
    return { contract: live, source: "live", values: values && typeof values === "object" ? values : {}, serverVersion: typeof version === "string" ? version : null, why: null, hash: compareHash(hash) };
  } catch (e) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "unreachable";
    return { contract: embedded, source: "embedded", values: {}, serverVersion: null, why: code };
  }
}
