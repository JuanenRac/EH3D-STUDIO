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
}

/** The contract as the page holds it: where it came from, the values in force (none for the copy) and why the live one could not be used. */
export interface LoadedContract {
  contract: SettingsContract;
  source: "live" | "embedded";
  values: Record<string, unknown>;
  serverVersion: string | null;
  /** The reason the live contract was not used (a code of the server, `schema` or `shape`); null for a live contract. */
  why: string | null;
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
export function unlistedSettings(contract: SettingsContract, values: Record<string, unknown>): Setting[] {
  const known = new Set(contract.settings.map((s) => s.key));
  return Object.keys(values)
    .filter((k) => !known.has(k))
    .sort()
    .map((key) => genericSetting(key, values[key]));
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
    return { contract: live, source: "live", values: values && typeof values === "object" ? values : {}, serverVersion: typeof version === "string" ? version : null, why: null };
  } catch (e) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "unreachable";
    return { contract: embedded, source: "embedded", values: {}, serverVersion: null, why: code };
  }
}
