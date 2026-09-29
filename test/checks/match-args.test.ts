import { describe, expect, it } from "vitest";

import { argMismatches } from "../../src/checks/match-args.js";

describe("argMismatches", () => {
  it("compares literals strictly, including nested values", () => {
    expect(
      argMismatches({ name: "Maya", seats: 2, vip: false }, { name: "Maya", seats: 2, vip: false }),
    ).toEqual([]);
    expect(argMismatches({ seats: 2 }, { seats: "2" })).toEqual(['seats: expected 2, got "2"']);
    expect(argMismatches({ note: null }, { note: null })).toEqual([]);
  });

  it("reports missing arguments", () => {
    expect(argMismatches({ date: "2026-10-03" }, {})).toEqual([
      'date: expected "2026-10-03", got missing',
    ]);
  });

  it("supports regex, any and oneOf", () => {
    const expected = {
      date: { regex: "^2026-10-" },
      note: { any: true as const },
      level: { oneOf: ["a", "b"] },
    };
    expect(argMismatches(expected, { date: "2026-10-03", note: "", level: "b" })).toEqual([]);
    expect(argMismatches(expected, { date: "2026-11-01", level: "c" })).toEqual([
      'date: expected /^2026-10-/, got "2026-11-01"',
      "note: expected any value, got missing",
      'level: expected one of ["a","b"], got "c"',
    ]);
  });

  it("applies regex to numbers and booleans but not to objects", () => {
    expect(argMismatches({ seats: { regex: "^[1-4]$" } }, { seats: 3 })).toEqual([]);
    expect(argMismatches({ data: { regex: "x" } }, { data: { x: 1 } })).toHaveLength(1);
  });
});
