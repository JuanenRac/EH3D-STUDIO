import { describe, expect, it } from "vitest";
import { DEFAULT_RACK, MAX_PLACE, buildRack, carryAssignment, checkSlots, fillInOrder, parseTools, problemOfDetail, selectable, withRack } from "./atc";

describe("the tool numbers typed by hand", () => {
  it("take spaces, commas and ranges, in order and once each", () => {
    expect(parseTools("1 2 3")).toEqual([1, 2, 3]);
    expect(parseTools("3, 1;2 2")).toEqual([1, 2, 3]);
    expect(parseTools("1-4 9")).toEqual([1, 2, 3, 4, 9]);
    expect(parseTools("")).toEqual([]);
  });

  it("refuse a word that is not a tool number", () => {
    for (const bad of ["a", "0", "100", "4-2", "1.5", "-3", "1 x 3"]) expect(parseTools(bad), bad).toBeNull();
  });
});

describe("the places of the tools (as in the window of BUNGARD-GUI)", () => {
  it("find a tool with no place, a place that two tools share and a place the machine does not define", () => {
    const p = checkSlots([1, 2, 3, 4], { 1: 5, 2: 5, 3: null, 4: 9 }, [1, 2, 3, 4, 5, 6]);
    expect(p).toContainEqual({ kind: "unassigned", tool: 3 });
    expect(p).toContainEqual({ kind: "undefined", tool: 4, place: 9 });
    expect(p).toContainEqual({ kind: "shared", place: 5, tools: [1, 2] });
  });

  it("has nothing to say about a job whose tools have each a place of its own", () => {
    expect(checkSlots([1, 2, 3], { 1: 1, 2: 2, 3: 3 })).toEqual([]);
    expect(checkSlots([], {})).toEqual([]);
  });

  it("takes every place from 1 to 14 when the machine file defines none", () => {
    expect(selectable()).toHaveLength(MAX_PLACE);
    expect(selectable([])).toHaveLength(MAX_PLACE);
    expect(selectable([3, 1, 20, 0])).toEqual([1, 3]);
    expect(checkSlots([1], { 1: 14 })).toEqual([]);
    expect(checkSlots([1], { 1: 15 })).toEqual([{ kind: "undefined", tool: 1, place: 15 }]);
  });

  it("refuses the test pin as a place for a tool", () => {
    expect(checkSlots([1], { 1: 0 })[0]).toEqual({ kind: "test_pin", tool: 1 });
  });

  it("finds what the server would refuse with bad_rack before the request goes out", () => {
    const opt = { ...DEFAULT_RACK };
    expect(checkSlots([1], { 1: 1 }, undefined, { ...opt, carryIn: true, first: 0 })).toContainEqual({ kind: "carry_in_needs_first" });
    expect(checkSlots([1], { 1: 1 }, undefined, { ...opt, carrySlot: 4 })).toContainEqual({ kind: "carry_without_in" });
    expect(checkSlots([1], { 1: 1 }, undefined, { ...opt, carryIn: true, first: 2, carrySlot: 0 })).toContainEqual({ kind: "carry_pin" });
    expect(checkSlots([1], { 1: 4 }, undefined, { ...opt, carryIn: true, first: 2, carrySlot: 4 })).toContainEqual({ kind: "carry_place_taken", place: 4 });
    expect(checkSlots([1], { 1: 1 }, undefined, { ...opt, first: 15 })).toContainEqual({ kind: "first_too_high", max: 14 });
    expect(checkSlots([1, 2, 3], { 1: 1, 2: 2, 3: 3 }, undefined, opt, 2)).toContainEqual({ kind: "too_many_tools", max: 2 });
    expect(checkSlots([1], { 1: 1 }, undefined, { ...opt, carryIn: true, first: 2, carrySlot: 4 })).toEqual([]);
  });

  it("fills in order the places that are free, and keeps the ones given", () => {
    expect(fillInOrder([1, 2, 3], { 2: 1 })).toEqual({ 1: 2, 2: 1, 3: 3 });
    expect(fillInOrder([1, 2], {}, [5, 7])).toEqual({ 1: 5, 2: 7 });
    const full = fillInOrder([1, 2, 3], {}, [1, 2]);
    expect(full[3] ?? null).toBeNull();
    expect(carryAssignment([1, 5], { 1: 3, 2: 4 })).toEqual({ 1: 3, 5: null });
  });
});

describe("the rack of the request", () => {
  it("writes only what differs from the defaults and the places by tool", () => {
    expect(buildRack([1, 2], { 1: null, 2: null }, DEFAULT_RACK)).toBeNull();
    expect(buildRack([1, 2], { 1: 6, 2: null }, DEFAULT_RACK)).toEqual({ slots: [{ tool: 1, place: 6 }] });
    expect(buildRack([1], { 1: 6 }, { first: 2, carryIn: true, carryOut: true, carrySlot: 4 })).toEqual({
      first: 2,
      carry_in: true,
      carry_out: true,
      slots: [{ tool: 1, place: 6 }],
      carry_slot: 4,
    });
    // a carry slot without the option is not written
    expect(buildRack([1], { 1: 6 }, { first: 0, carryIn: false, carryOut: false, carrySlot: 4 })).toEqual({ slots: [{ tool: 1, place: 6 }] });
  });

  it("puts the version 2 and the rack into a request and keeps its other fields; without a rack, it takes the old one out", () => {
    const base = { kind: "route", name: "x" };
    expect(withRack(base, { slots: [{ tool: 1, place: 3 }] })).toEqual({ kind: "route", name: "x", request_version: 2, rack: { slots: [{ tool: 1, place: 3 }] } });
    expect(withRack({ ...base, request_version: 2, rack: { first: 1 } }, null)).toEqual(base);
    expect(withRack({ ...base, rack: { first: 1 } }, { first: 3 }).rack).toEqual({ first: 3 });
  });

  it("read the stable sentences of the refusal bad_rack", () => {
    expect(problemOfDetail("rack.slots: place 6 is given to two tools")).toEqual({ kind: "shared", place: 6, tools: [] });
    expect(problemOfDetail("rack.slots: place 0 is the test pin, not a place for tool 2")).toEqual({ kind: "test_pin", tool: 2 });
    expect(problemOfDetail("rack.carry_slot needs rack.carry_in")).toEqual({ kind: "carry_without_in" });
    expect(problemOfDetail("rack.carry_slot: place 0 is the test pin")).toEqual({ kind: "carry_pin" });
    expect(problemOfDetail("rack.carry_slot: place 4 is also the place of a tool of this job")).toEqual({ kind: "carry_place_taken", place: 4 });
    expect(problemOfDetail("rack.first may be up to 14 places")).toEqual({ kind: "first_too_high", max: 14 });
    expect(problemOfDetail("place 9 of the rack is not defined in the configuration file of the machine")).toMatchObject({ kind: "undefined", place: 9 });
    expect(problemOfDetail("the rack of the machine holds 14 tools at the most")).toEqual({ kind: "too_many_tools", max: 14 });
    expect(problemOfDetail("something else")).toBeNull();
  });
});
