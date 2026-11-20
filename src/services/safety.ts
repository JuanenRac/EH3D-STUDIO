/*
 * The safety of the machines of the plugins (`laser`, `pnp`, `pcb`, `cnc`, `gerber`, `cam`, `printer3d`, `vision`, `cad`; docs/MACHINE_PLUGINS.md of EH3D-SERVER) as the
 * panel shows it: whether a machine has only run against a simulator, which interlock holds it, and which safe actions a person has on it. The SERVER decides in the end; these
 * rules keep the page from offering what would be refused and from hiding what must be seen.
 * GPL-3.0-or-later.
 */
import { can } from "./permissions";
import type { Who } from "./permissions";

/** What may keep a machine from starting: a latch (after an emergency stop or a fault), the latch of an emergency stop, or an alarm. */
export type Interlock = "latched" | "estop_latched" | "alarm";

/** The safe actions of a machine: the emergency stop (no confirmation) and the release of a latch (an administrator, with a confirmation). */
export type SafetyAction = "emergency_stop" | "release";

type Detail = Record<string, unknown> | null | undefined;

/** The plugins with a route of their own for the emergency stop; the others stop by cancelling the job that runs. */
const STOP_ROUTES: Readonly<Record<string, string>> = { cnc: "emergency-stop", printer3d: "emergency-stop" };
/** The plugins that latch and the route that releases the latch. */
const RELEASE_ROUTES: Readonly<Record<string, string>> = { cnc: "release", printer3d: "release", laser: "laser/release" };
/** The plugins whose job waits for a person to start it. */
const MANUAL_START: readonly string[] = ["printer3d"];

/** Whether the machine has only run against a simulator: the server says so in `detail` (`simulator_only`, `evidence`) and in the capabilities (`evidence`). Never shown as proven on hardware. */
export function isSimulatorOnly(detail: Detail, caps?: Record<string, unknown> | null): boolean {
  if (detail?.simulator_only === true || detail?.evidence === "simulator") return true;
  return caps?.evidence === "simulator";
}

const NO_ALARM: readonly string[] = ["", "none", "ok", "false", "0", "idle", "run"];

/** The interlocks that hold the machine, in the order the page shows them. */
export function interlocks(detail: Detail): Interlock[] {
  const out: Interlock[] = [];
  if (!detail) return out;
  if (detail.latched === true) out.push("latched");
  if (detail.estop_latched === true) out.push("estop_latched");
  const a = detail.alarm;
  const word = detail.state_word;
  if (a === true || (typeof a === "string" && !NO_ALARM.includes(a.trim().toLowerCase())) || (typeof word === "string" && word.trim().toLowerCase() === "alarm")) out.push("alarm");
  return out;
}

export const INTERLOCK_TEXT = { latched: "il_latched", estop_latched: "il_estop_latched", alarm: "il_alarm" } as const;

/** The route of the emergency stop of the plugin under `/work/machines/{id}/`, or null when the plugin stops by cancelling its job. */
export function stopRoute(plugin: string): string | null {
  return STOP_ROUTES[plugin] ?? null;
}

/** The route that releases the latch of the plugin under `/work/machines/{id}/`, or null when the plugin does not latch. */
export function releaseRoute(plugin: string): string | null {
  return RELEASE_ROUTES[plugin] ?? null;
}

/**
 * The safe actions this person has on a machine. The emergency stop is for an operator (`jobs:cancel`), is never asked twice, and is offered when the plugin has a route for it or a
 * job runs on the machine, unless the machine is already held by an interlock. The release is for an administrator (`machines:manage`), only for a machine that is held and whose
 * plugin has a route for it, and the page asks twice.
 */
export function safetyActions(who: Who | null | undefined, plugin: string, detail: Detail, job: string | null | undefined): SafetyAction[] {
  const out: SafetyAction[] = [];
  const held = interlocks(detail);
  if (can(who, "jobs.cancel") && held.length === 0 && (stopRoute(plugin) !== null || (job !== null && job !== undefined && job !== ""))) out.push("emergency_stop");
  if (can(who, "machines.manage") && held.length > 0 && releaseRoute(plugin) !== null) out.push("release");
  return out;
}

/** Whether a job of this plugin waits in the queue for a person to start it. Studio never starts a job by itself: the start is always a touch, asked twice. */
export function needsManualStart(plugin: string): boolean {
  return MANUAL_START.includes(plugin);
}

/** Whether the machine says that its queue starts the next job by itself (`auto_start_queue` in its detail): shown as a warning, never switched on from here. */
export function startsByItself(detail: Detail): boolean {
  return detail?.auto_start_queue === true || detail?.auto_start === true;
}

/** The keys of `detail` the page shows in its own way. */
const SHOWN_APART: readonly string[] = ["evidence", "simulator_only", "latched", "estop_latched", "alarm", "auto_start_queue", "auto_start"];

/** What else the plugin says of the machine, as short `key: value` pairs (numbers, texts and flags only, at most `limit` of them, in the order of the plugin). */
export function detailFacts(detail: Detail, limit = 6): { key: string; value: string }[] {
  if (!detail) return [];
  const out: { key: string; value: string }[] = [];
  for (const [key, v] of Object.entries(detail)) {
    if (SHOWN_APART.includes(key)) continue;
    if (typeof v === "number" || typeof v === "boolean" || (typeof v === "string" && v !== "" && v.length <= 40)) out.push({ key, value: String(v) });
    if (out.length >= limit) break;
  }
  return out;
}

/** The switch that keeps the logins across a restart of the server (the update of the server restarts it): its own text says to turn it on BEFORE updating. It wins over the generic line of the settings of the server. */
export const PERSISTENCE_NOTES: Readonly<Record<string, "sw_note_persist_sessions">> = {
  persist_sessions: "sw_note_persist_sessions",
};

/** The switches of security that the server brings and whose meaning the page explains: all of them are off by default. */
export const SWITCH_NOTES: Readonly<Record<string, "sw_note_mdns_announce" | "sw_note_compat_api" | "sw_note_compat_write" | "sw_note_slice_enabled">> = {
  mdns_announce: "sw_note_mdns_announce",
  compat_api: "sw_note_compat_api",
  compat_write: "sw_note_compat_write",
  slice_enabled: "sw_note_slice_enabled",
};
