import { describe, expect, it } from "vitest";

import { evidenceValues, extractClaims } from "../../src/checks/claims.js";

const values = (text: string) => extractClaims(text).map((claim) => `${claim.kind}:${claim.value}`);

describe("extractClaims", () => {
  it.each([
    ["The class costs $45.", "money:45.00"],
    ["It is $45.50 per seat.", "money:45.50"],
    ["Total: R$ 1.234,56", "money:1234.56"],
    ["Pay €1,500 upfront", "money:1500.00"],
    ["Only £9.9 today", "money:9.90"],
  ])("finds the price in %j", (text, expected) => {
    expect(values(text)).toEqual([expected]);
  });

  it.each([
    ["Starts at 9:30", "time:09:30"],
    ["Starts at 9:30 pm", "time:21:30"],
    ["Starts at 9am", "time:09:00"],
    ["Ends at 12 am", "time:00:00"],
    ["Ends at 12pm", "time:12:00"],
    ["Opens 18:00", "time:18:00"],
  ])("finds the time in %j", (text, expected) => {
    expect(values(text)).toEqual([expected]);
  });

  it.each([
    ["On 2026-10-03", "date:10-03"],
    ["On October 3rd", "date:10-03"],
    ["On Oct. 3", "date:10-03"],
    ["On Sept 21", "date:09-21"],
  ])("finds the date in %j", (text, expected) => {
    expect(values(text)).toEqual([expected]);
  });

  it("ignores text without checkable details", () => {
    expect(values("Sure, I can help with that. See you soon!")).toEqual([]);
  });
});

describe("evidenceValues", () => {
  it("also treats plain numbers as prices, so JSON tool output grounds them", () => {
    const evidence = evidenceValues('{"price": 45, "start": "09:30", "date": "2026-10-03"}');
    expect(evidence.has("money:45.00")).toBe(true);
    expect(evidence.has("time:09:30")).toBe(true);
    expect(evidence.has("date:10-03")).toBe(true);
  });
});
