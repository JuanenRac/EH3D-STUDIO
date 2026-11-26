/*
 * The 3D printers the server watches (`GET /api/v1/printers`; docs/API.md of EH3D-SERVER, contract `eh3d.printers.status/1`), **read only**: the client asks with GET and
 * has no way to ask a printer to do anything. The answer is read field by field: what is missing, of another type or not a number a printer can mean is unknown (`null`),
 * never zero, and an answer that is not the contract is refused. Everything seen here was seen against a simulator: nothing has run on a real printer. GPL-3.0-or-later.
 */
import { ApiError } from "../api";
import type { TextKey } from "../i18n";
import type { ServiceHttp } from "./http";

export const PRINTERS_SCHEMA = "eh3d.printers.status/1";

export const PRINTER_HEALTHS = ["disabled", "off", "unknown", "online", "stale", "offline", "refused", "untrusted", "bad_report"] as const;
export type PrinterHealth = (typeof PRINTER_HEALTHS)[number];

export const PRINTER_STATES = ["unknown", "idle", "preparing", "printing", "paused", "finished", "failed", "cancelled", "error", "emergency"] as const;
export type PrinterState = (typeof PRINTER_STATES)[number];

export const TEMPERATURE_NAMES = ["nozzle", "bed", "chamber"] as const;
export type TemperatureName = (typeof TEMPERATURE_NAMES)[number];

export interface PrinterTemperature {
  name: TemperatureName;
  current: number | null;
  target: number | null;
}

export interface PrinterAlert {
  severity: "error" | "warning" | "info";
  code: string;
  message: string;
}

export interface Printer {
  id: string;
  name: string;
  family: string;
  health: PrinterHealth;
  /** Whether what is shown is what the printer is now. */
  current: boolean;
  /** `null` when the server shows nothing of what the printer said. */
  state: PrinterState | null;
  temperatures: PrinterTemperature[];
  progress: number | null;
  remainingS: number | null;
  remainingEstimated: boolean;
  layer: number | null;
  layers: number | null;
  job: string;
  alerts: PrinterAlert[];
  camera: boolean | null;
  ageS: number | null;
  certificateSeen: string;
  simulated: boolean;
}

const MAX_PRINTERS = 64;
const MAX_ALERTS = 32;
const MAX_TEXT = 128;

type Record_ = Record<string, unknown>;

function record(v: unknown): Record_ | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record_) : null;
}

function text(v: unknown): string {
  if (typeof v !== "string") return "";
  // control characters and the ones that turn the reading order around are not shown
  return [...v.replace(/[\p{Cc}\u200b-\u200f\u202a-\u202e\u2066-\u2069]/gu, "")].slice(0, MAX_TEXT).join("");
}

function within(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
}

function oneOf<T extends string>(v: unknown, words: readonly T[], otherwise: T): T {
  return typeof v === "string" && (words as readonly string[]).includes(v) ? (v as T) : otherwise;
}

function temperatures(v: unknown): PrinterTemperature[] {
  if (!Array.isArray(v)) return [];
  const out: PrinterTemperature[] = [];
  for (const entry of v) {
    const t = record(entry);
    if (!t || typeof t.name !== "string" || !(TEMPERATURE_NAMES as readonly string[]).includes(t.name)) continue;
    if (out.some((x) => x.name === t.name)) continue;
    out.push({ name: t.name as TemperatureName, current: within(t.current_c, -100, 1000), target: within(t.target_c, -100, 1000) });
  }
  return out;
}

function alerts(v: unknown): PrinterAlert[] {
  if (!Array.isArray(v)) return [];
  const out: PrinterAlert[] = [];
  for (const entry of v.slice(0, MAX_ALERTS)) {
    const a = record(entry);
    if (!a) continue;
    // an alert whose severity is not known is taken as a warning, never dropped
    out.push({ severity: oneOf(a.severity, ["error", "warning", "info"] as const, "warning"), code: text(a.code), message: text(a.message) });
  }
  return out;
}

/** One printer of the answer; `null` when it has no id. */
export function parsePrinter(v: unknown): Printer | null {
  const p = record(v);
  if (!p) return null;
  const id = text(p.id);
  if (id === "") return null;
  // a health this version does not know is not taken as online
  const health = oneOf(p.health, PRINTER_HEALTHS, "unknown");
  const s = health === "online" || health === "stale" ? record(p.status) : null;
  const camera = record(s?.camera);
  return {
    id,
    name: text(p.name) || id,
    family: text(p.family),
    health,
    current: health === "online" && p.current === true,
    state: s ? oneOf(s.state, PRINTER_STATES, "unknown") : null,
    temperatures: temperatures(s?.temperatures),
    progress: within(s?.progress_pct, 0, 100),
    remainingS: within(s?.remaining_s, 0, 366 * 24 * 3600),
    remainingEstimated: s?.remaining_estimated === true,
    layer: within(s?.layer, 0, 1_000_000),
    layers: within(s?.layers, 1, 1_000_000),
    job: text(s?.job_name),
    alerts: alerts(s?.alerts),
    camera: camera && typeof camera.present === "boolean" ? camera.present : null,
    ageS: within(p.age_s, 0, Number.MAX_SAFE_INTEGER),
    certificateSeen: /^[0-9a-f]{64}$/.test(String(p.certificate_seen ?? "")) ? String(p.certificate_seen) : "",
    simulated: p.simulator_only === true,
  };
}

/** The printers of an answer. An answer that is not the contract is refused: an empty list must not be taken for "no printers". */
export function parsePrinters(v: unknown): Printer[] {
  const doc = record(v);
  if (!doc || doc.schema !== PRINTERS_SCHEMA || !Array.isArray(doc.printers)) throw new ApiError(0, "bad_response", PRINTERS_SCHEMA);
  const out: Printer[] = [];
  for (const entry of doc.printers.slice(0, MAX_PRINTERS)) {
    const p = parsePrinter(entry);
    if (p && !out.some((x) => x.id === p.id)) out.push(p);
  }
  return out;
}

/** The client. It only reads: registering a printer is done on the server, and nothing can be sent to a printer. */
export class PrinterClient {
  constructor(private http: ServiceHttp) {}

  list = async (): Promise<Printer[]> => parsePrinters(await this.http.json<unknown>("GET", "/printers"));
}

// ---- how it is shown

export function healthTone(health: PrinterHealth): "ok" | "wait" | "bad" | "dim" {
  if (health === "online") return "ok";
  if (health === "stale") return "wait";
  if (health === "disabled" || health === "off" || health === "unknown") return "dim";
  return "bad";
}

export function stateTone(state: PrinterState): "ok" | "run" | "wait" | "bad" | "dim" {
  if (state === "printing" || state === "preparing") return "run";
  if (state === "finished") return "ok";
  if (state === "paused" || state === "cancelled") return "wait";
  if (state === "failed" || state === "error" || state === "emergency") return "bad";
  return "dim";
}

export function healthKey(health: PrinterHealth): TextKey {
  return `pr_health_${health}` as TextKey;
}

export function stateKey(state: PrinterState): TextKey {
  return `pr_state_${state}` as TextKey;
}

/** A time left as hours and minutes, rounded up to the minute. */
export function remainingParts(seconds: number): { h: number; m: number } {
  const minutes = Math.ceil(seconds / 60);
  return { h: Math.floor(minutes / 60), m: minutes % 60 };
}

/** A temperature with its target, `-` for what is not known. */
export function temperatureText(t: Pick<PrinterTemperature, "current" | "target">): string {
  const c = t.current === null ? "-" : String(Math.round(t.current));
  return t.target === null ? `${c} °C` : `${c} / ${Math.round(t.target)} °C`;
}

// ---- warnings

export type WarningKind = "emergency" | "error" | "failed" | "alert" | "paused" | "refused" | "untrusted" | "bad_report" | "offline" | "stale";

export interface PrinterWarning {
  /** What makes it the same warning from one reading to the next. */
  key: string;
  printer: string;
  kind: WarningKind;
  /** The codes of the alerts of the printer, for an `alert`. */
  detail: string;
  serious: boolean;
}

/** What a person should know about now. A printer switched off, never read or in good order says nothing. */
export function warningsOf(printers: readonly Printer[]): PrinterWarning[] {
  const out: PrinterWarning[] = [];
  const add = (p: Printer, kind: WarningKind, serious: boolean, detail = "") => out.push({ key: `${p.id}|${kind}|${detail}`, printer: p.name, kind, detail, serious });
  for (const p of printers) {
    if (p.health === "refused" || p.health === "untrusted" || p.health === "bad_report") add(p, p.health, true);
    else if (p.health === "offline") add(p, "offline", false);
    else if (p.health === "stale") add(p, "stale", false);
    if (p.state === "emergency" || p.state === "error" || p.state === "failed") add(p, p.state, true);
    else if (p.state === "paused") add(p, "paused", false);
    const told = p.alerts.filter((a) => a.severity !== "info");
    if (told.length > 0) {
      const detail = told.map((a) => (a.message ? `${a.code} ${a.message}` : a.code)).join(", ");
      add(
        p,
        "alert",
        told.some((a) => a.severity === "error"),
        detail,
      );
    }
  }
  return out;
}

export function warningKey(kind: WarningKind): TextKey {
  return `pr_warn_${kind}` as TextKey;
}

/** The warnings that were not there before, and the printers that were printing and now say they finished. */
export function news(before: readonly Printer[], now: readonly Printer[]): { warnings: PrinterWarning[]; finished: string[] } {
  const known = new Set(warningsOf(before).map((w) => w.key));
  const warnings = warningsOf(now).filter((w) => !known.has(w.key));
  const finished = now.filter((p) => p.state === "finished" && before.some((b) => b.id === p.id && (b.state === "printing" || b.state === "paused"))).map((p) => p.name);
  return { warnings, finished };
}
