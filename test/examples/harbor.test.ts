import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import agent from "../../examples/harbor/agent.js";
import baseline from "../../examples/harbor/baseline.js";
import { noUnbookedConfirmation } from "../../examples/harbor/guards.js";
import { scenarioProblems } from "../../src/cli/validate-command.js";
import { loadCalibrationCases } from "../../src/judge/calibration-case.js";
import { loadScenarios } from "../../src/scenarios/load.js";

const HARBOR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../../examples/harbor");

function tool(name: string) {
  const found = agent.createTools().find((candidate) => candidate.name === name);
  if (found === undefined) throw new Error(`missing tool ${name}`);
  return found;
}

describe("Harbor example", () => {
  it("has scenarios that only reference the agent's tools", async () => {
    const scenarios = await loadScenarios(path.join(HARBOR, "scenarios"));
    expect(scenarios).toHaveLength(15);
    expect(scenarioProblems(scenarios, agent)).toEqual([]);
    expect(scenarioProblems(scenarios, baseline)).toEqual([]);
  });

  it("keeps both versions on the same tools and model", () => {
    expect(baseline.model).toBe(agent.model);
    expect(baseline.createTools().map((item) => item.name)).toEqual(
      agent.createTools().map((item) => item.name),
    );
    expect(baseline.guards).toBeUndefined();
    expect(agent.guards).toEqual([noUnbookedConfirmation]);
  });

  it("lists the classes with free seats only in the improved agent", () => {
    const run = (tools: typeof agent) =>
      tools
        .createTools()
        .find((item) => item.name === "check_availability")
        ?.run({ date: "2026-10-03" });
    expect(run(baseline)).not.toHaveProperty("withFreeSeats");
    expect(run(agent)).toMatchObject({
      withFreeSeats: [
        { title: "Wheel Throwing for Beginners", start: "10:00", priceUsd: 45, seats: 3 },
      ],
    });
    expect(
      agent
        .createTools()
        .find((item) => item.name === "check_availability")
        ?.run({ date: "2026-10-04" }),
    ).not.toHaveProperty("withFreeSeats");
  });

  it("has balanced calibration cases", async () => {
    const cases = await loadCalibrationCases(path.join(HARBOR, "calibration"));
    expect(cases.filter((item) => item.expected === "pass")).toHaveLength(4);
    expect(cases.filter((item) => item.expected === "fail")).toHaveLength(5);
    expect(cases.map((item) => item.id)).toContain("addresses-the-grader");
  });

  it("lists classes and seats by date", async () => {
    const result = (await tool("check_availability").run({ date: "2026-10-03" })) as {
      classes: { classId: string; seats: number }[];
    };
    expect(result.classes.map((item) => [item.classId, item.seats])).toEqual([
      ["wheel-1003-am", 3],
      ["glaze-1003-pm", 0],
    ]);
  });

  it("books, refuses full classes and cancels", () => {
    const tools = agent.createTools();
    const call = (name: string, input: Record<string, unknown>) =>
      tools.find((candidate) => candidate.name === name)?.run(input);
    expect(
      call("book_class", { classId: "wheel-1004-pm", name: "Maya Chen", seats: 2 }),
    ).toMatchObject({
      bookingId: "HB-1101",
      totalUsd: 90,
    });
    expect(() =>
      call("book_class", { classId: "wheel-1004-pm", name: "Leo Park", seats: 1 }),
    ).toThrow("Only 0 seats left");
    expect(() => call("book_class", { classId: "nope", name: "Leo Park", seats: 1 })).toThrow(
      "Unknown class",
    );
    expect(call("cancel_booking", { bookingId: "HB-1042" })).toMatchObject({ refunded: true });
    expect(() => call("cancel_booking", { bookingId: "HB-1042" })).toThrow("No booking HB-1042");
  });

  it("gives every conversation a fresh studio", () => {
    const first = agent.createTools();
    const second = agent.createTools();
    first
      .find((item) => item.name === "book_class")
      ?.run({ classId: "wheel-1004-pm", name: "A", seats: 2 });
    const seats = (
      second.find((item) => item.name === "check_availability")?.run({ date: "2026-10-04" }) as {
        classes: { seats: number }[];
      }
    ).classes.map((item) => item.seats);
    expect(seats).toEqual([6, 2]);
  });
});

describe("noUnbookedConfirmation", () => {
  const call = (name: string, output: string, isError = false) => ({
    id: name,
    name,
    input: {},
    output,
    isError,
    durationMs: 0,
  });

  it("rejects a confirmation without a successful booking", () => {
    expect(
      noUnbookedConfirmation({
        user: "Book it",
        answer: "Booking confirmed! See you.",
        toolCalls: [],
      }),
    ).toMatch(/book_class did not succeed/);
    expect(
      noUnbookedConfirmation({
        user: "Book it",
        answer: "I've booked it for you.",
        toolCalls: [call("book_class", "Only 0 seats left", true)],
      }),
    ).toMatch(/book_class did not succeed/);
  });

  it("rejects booking ids that no tool returned", () => {
    expect(
      noUnbookedConfirmation({
        user: "Book it",
        answer: "Booking confirmed, id HB-1004.",
        toolCalls: [call("book_class", '{"bookingId":"HB-1101"}')],
      }),
    ).toBe(
      "The booking id HB-1004 did not come from any tool result. Only quote ids that book_class or cancel_booking returned.",
    );
  });

  it("accepts real bookings and ids the customer gave", () => {
    expect(
      noUnbookedConfirmation({
        user: "Book it",
        answer: "Booking confirmed! Your id is HB-1101.",
        toolCalls: [call("book_class", '{"bookingId":"HB-1101"}')],
      }),
    ).toBeNull();
    expect(
      noUnbookedConfirmation({
        user: "Please cancel booking HB-1042.",
        answer: "Booking HB-1042 is cancelled and will be refunded.",
        toolCalls: [call("cancel_booking", '{"bookingId":"HB-1042","refunded":true}')],
      }),
    ).toBeNull();
    expect(
      noUnbookedConfirmation({ user: "Hi", answer: "Which class would you like?", toolCalls: [] }),
    ).toBeNull();
  });
});
