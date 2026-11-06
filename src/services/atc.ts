/*
 * The places of the tools in the bar of the tool changer (the `rack` of the second version of the request of a job, docs/ATC_CHAIN.md of EH3D-SERVER). The check is the one
 * of the window of BUNGARD-GUI: a tool with no place, a place that two tools share and a place the machine does not define stop the job; the rest are the refusals the
 * server would answer `422 bad_rack`, found before the request goes out. Place 0 is the test pin; the bar holds the places 1 to 14. GPL-3.0-or-later.
 */
import type { JobRackV2, RackSlot } from "./types";

/** The highest place of the bar. */
export const MAX_PLACE = 14;

/** The tool and its place (null: none yet). */
export type Assignment = Record<number, number | null>;

export type Problem =
  | { kind: "unassigned"; tool: number }
  | { kind: "undefined"; tool: number; place: number }
  | { kind: "shared"; place: number; tools: number[] }
  | { kind: "test_pin"; tool: number }
  | { kind: "carry_without_in" }
  | { kind: "carry_pin" }
  | { kind: "carry_in_needs_first" }
  | { kind: "carry_place_taken"; place: number }
  | { kind: "first_too_high"; max: number }
  | { kind: "too_many_tools"; max: number };

/** The tool numbers typed as `1 2 3`, `1,2,3` or `1-3`: whole numbers from 1 to 99, in order, without repeats; null when a word is not a tool number. */
export function parseTools(text: string): number[] | null {
  const out: number[] = [];
  for (const word of text.split(/[\s,;]+/).filter(Boolean)) {
    const range = /^(\d{1,2})-(\d{1,2})$/.exec(word);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      if (a < 1 || b < a || b > 99) return null;
      for (let n = a; n <= b; n++) out.push(n);
    } else if (/^\d{1,2}$/.test(word) && Number(word) >= 1) {
      out.push(Number(word));
    } else {
      return null;
    }
  }
  return [...new Set(out)].sort((x, y) => x - y);
}

/** The places a tool can be given: the ones the machine file defines (all of them when it defines none), from 1 to 14. */
export function selectable(defined?: readonly number[]): number[] {
  const all = Array.from({ length: MAX_PLACE }, (_, i) => i + 1);
  if (!defined || defined.length === 0) return all;
  return all.filter((p) => defined.includes(p));
}

export interface RackOptions {
  first: number;
  carryIn: boolean;
  carryOut: boolean;
  /** With `carryIn`, the place of the tool the chuck comes holding (null: the same as `first`). */
  carrySlot: number | null;
}

export const DEFAULT_RACK: RackOptions = { first: 0, carryIn: false, carryOut: false, carrySlot: null };

/** What is wrong with the places of the tools of the job; empty when the job can start. */
export function checkSlots(tools: readonly number[], assign: Assignment, defined?: readonly number[], options: RackOptions = DEFAULT_RACK, maxSlots = MAX_PLACE): Problem[] {
  const ok = selectable(defined);
  const out: Problem[] = [];
  const by = new Map<number, number[]>();
  for (const tool of tools) {
    const place = assign[tool] ?? null;
    if (place === null) {
      out.push({ kind: "unassigned", tool });
      continue;
    }
    if (place === 0) out.push({ kind: "test_pin", tool });
    else if (!ok.includes(place)) out.push({ kind: "undefined", tool, place });
    by.set(place, [...(by.get(place) ?? []), tool]);
  }
  for (const [place, who] of by) if (who.length > 1) out.push({ kind: "shared", place, tools: who });
  if (tools.length > maxSlots) out.push({ kind: "too_many_tools", max: maxSlots });
  if (options.first > maxSlots) out.push({ kind: "first_too_high", max: maxSlots });
  if (options.carryIn && options.first <= 0) out.push({ kind: "carry_in_needs_first" });
  if (options.carrySlot !== null) {
    if (!options.carryIn) out.push({ kind: "carry_without_in" });
    else if (options.carrySlot === 0) out.push({ kind: "carry_pin" });
    else if (tools.some((tool) => assign[tool] === options.carrySlot)) out.push({ kind: "carry_place_taken", place: options.carrySlot });
  }
  return out;
}

/** Gives a place to each tool that has none, in order: the lowest free places first. A tool that has a place keeps it; when the places run out the rest stay without one. */
export function fillInOrder(tools: readonly number[], assign: Assignment, defined?: readonly number[]): Assignment {
  const next: Assignment = { ...assign };
  const taken = new Set(tools.map((t) => next[t]).filter((p): p is number => p !== null && p !== undefined));
  const free = selectable(defined).filter((p) => !taken.has(p));
  for (const tool of tools) {
    if ((next[tool] ?? null) !== null) continue;
    const place = free.shift();
    if (place === undefined) break;
    next[tool] = place;
  }
  return next;
}

/** The tools of the job with the places they had before, and no place for a tool that is new. */
export function carryAssignment(tools: readonly number[], before: Assignment): Assignment {
  const out: Assignment = {};
  for (const t of tools) out[t] = before[t] ?? null;
  return out;
}

/** The `rack` of the request: only what differs from the defaults is written, and the slots go by tool. Null when nothing is asked of the rack. */
export function buildRack(tools: readonly number[], assign: Assignment, options: RackOptions): JobRackV2 | null {
  const slots: RackSlot[] = tools.filter((t) => (assign[t] ?? null) !== null).map((t) => ({ tool: t, place: assign[t] as number }));
  const rack: JobRackV2 = {};
  if (options.first > 0) rack.first = options.first;
  if (options.carryIn) rack.carry_in = true;
  if (options.carryOut) rack.carry_out = true;
  if (slots.length > 0) rack.slots = slots;
  if (options.carryIn && options.carrySlot !== null) rack.carry_slot = options.carrySlot;
  return Object.keys(rack).length === 0 ? null : rack;
}

/** The request with the version 2 and the rack put in (a request typed by hand keeps all its other fields). */
export function withRack(request: Record<string, unknown>, rack: JobRackV2 | null): Record<string, unknown> {
  const { rack: _old, request_version: version, ...rest } = request;
  void _old;
  if (rack === null) return version === undefined || version === 2 ? rest : { ...rest, request_version: version };
  return { ...rest, request_version: 2, rack };
}

/** The refusal `bad_rack` of the server as a problem the page can say in words (the details are stable sentences), or null when the sentence is not one of them. */
export function problemOfDetail(detail: string): Problem | null {
  let m = /^rack\.slots: place (\d+) is given to two tools$/.exec(detail);
  if (m) return { kind: "shared", place: Number(m[1]), tools: [] };
  m = /^rack\.slots: place 0 is the test pin, not a place for tool (\d+)$/.exec(detail);
  if (m) return { kind: "test_pin", tool: Number(m[1]) };
  if (detail === "rack.carry_slot needs rack.carry_in") return { kind: "carry_without_in" };
  if (detail === "rack.carry_slot: place 0 is the test pin") return { kind: "carry_pin" };
  m = /^rack\.carry_slot: place (\d+) is also the place of a tool of this job$/.exec(detail);
  if (m) return { kind: "carry_place_taken", place: Number(m[1]) };
  m = /^rack\.first may be up to (\d+) places$/.exec(detail);
  if (m) return { kind: "first_too_high", max: Number(m[1]) };
  m = /^place (\d+) of the rack is not defined in the configuration file of the machine$/.exec(detail);
  if (m) return { kind: "undefined", tool: 0, place: Number(m[1]) };
  m = /^the rack of the machine holds (\d+) tools at the most$/.exec(detail);
  if (m) return { kind: "too_many_tools", max: Number(m[1]) };
  return null;
}
