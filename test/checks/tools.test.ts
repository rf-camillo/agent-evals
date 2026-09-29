import { describe, expect, it } from "vitest";

import { forbiddenToolsCheck, toolsCheck } from "../../src/checks/tools.js";
import { weatherAgent } from "../support/helpers.js";
import { scenario, transcript } from "../support/transcripts.js";

const agent = weatherAgent();

const booked = transcript(
  { answer: "Checking.", calls: [{ name: "check_availability", input: { date: "2026-10-03" } }] },
  { answer: "Booked.", calls: [{ name: "book_class", input: { name: "Maya Chen", seats: 1 } }] },
);

describe("toolsCheck", () => {
  it("is skipped when no tools are expected", () => {
    expect(toolsCheck({ scenario: scenario(), transcript: booked, agent })).toBeNull();
  });

  it("passes when every expected call happened, in any order", () => {
    const expect_ = {
      tools: [{ call: "book_class", args: { name: "Maya Chen" } }, { call: "check_availability" }],
    };
    expect(
      toolsCheck({ scenario: scenario({ expect: expect_ }), transcript: booked, agent }),
    ).toEqual({
      name: "tools",
      passed: true,
      failures: [],
    });
  });

  it("explains a missing call and a call with other arguments", () => {
    const expect_ = {
      tools: [{ call: "cancel_booking" }, { call: "book_class", args: { name: "Leo Park" } }],
    };
    expect(
      toolsCheck({ scenario: scenario({ expect: expect_ }), transcript: booked, agent })?.failures,
    ).toEqual([
      "cancel_booking was never called",
      'book_class was called with other arguments (name: expected "Leo Park", got "Maya Chen")',
    ]);
  });

  it("uses each call once, so two expectations need two calls", () => {
    const expect_ = { tools: [{ call: "book_class" }, { call: "book_class" }] };
    expect(
      toolsCheck({ scenario: scenario({ expect: expect_ }), transcript: booked, agent })?.passed,
    ).toBe(false);
  });

  it("enforces order when asked", () => {
    const inOrder = {
      ordered: true,
      tools: [{ call: "check_availability" }, { call: "book_class" }],
    };
    const reversed = {
      ordered: true,
      tools: [{ call: "book_class" }, { call: "check_availability" }],
    };
    expect(
      toolsCheck({ scenario: scenario({ expect: inOrder }), transcript: booked, agent })?.passed,
    ).toBe(true);
    expect(
      toolsCheck({ scenario: scenario({ expect: reversed }), transcript: booked, agent })?.failures,
    ).toEqual(["check_availability was called before book_class, expected after"]);
  });

  it("explains a missing call in ordered mode", () => {
    const missing = { ordered: true, tools: [{ call: "check_availability" }, { call: "pay" }] };
    expect(
      toolsCheck({ scenario: scenario({ expect: missing }), transcript: booked, agent })?.failures,
    ).toEqual(["pay was never called"]);
  });
});

describe("forbiddenToolsCheck", () => {
  it("is skipped without forbidden tools and fails on each forbidden call", () => {
    expect(forbiddenToolsCheck({ scenario: scenario(), transcript: booked, agent })).toBeNull();
    const result = forbiddenToolsCheck({
      scenario: scenario({ expect: { forbidTools: ["book_class", "cancel_booking"] } }),
      transcript: booked,
      agent,
    });
    expect(result?.failures).toEqual([
      'book_class must not be called (input {"name":"Maya Chen","seats":1})',
    ]);
  });
});
