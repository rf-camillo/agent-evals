import { describe, expect, it } from "vitest";

import { calibrate } from "../../src/judge/calibrate.js";
import {
  type CalibrationCase,
  caseTranscript,
  loadCalibrationCases,
} from "../../src/judge/calibration-case.js";
import { ScriptedProvider, toolCall } from "../../src/providers/scripted.js";
import { writeFiles } from "../support/helpers.js";

const CASES_YAML = `
id: quotes-tool-price
rubric: Quotes the price returned by the tools.
conversation:
  - user: How much?
    tools:
      - name: get_price
        output: '{"price": 45}'
    agent: It is $45.
expected: pass
---
id: invents-discount
rubric: Quotes the price returned by the tools.
facts: [No discounts exist.]
conversation:
  - user: Any discount?
    agent: Yes, 20% off today!
expected: fail
`;

async function cases(): Promise<CalibrationCase[]> {
  const root = await writeFiles({ "calibration/cases.yaml": CASES_YAML });
  return loadCalibrationCases(`${root}/calibration`);
}

function judgeSaying(verdicts: Record<string, "pass" | "fail" | "broken">): ScriptedProvider {
  return new ScriptedProvider((request) => {
    const message = request.messages[0];
    const prompt = message?.role === "user" ? message.content : "";
    const id = prompt.includes("How much?") ? "quotes-tool-price" : "invents-discount";
    const verdict = verdicts[id];
    if (verdict === "broken") return [];
    return [toolCall("record_verdict", { reasoning: `Graded ${id}.`, verdict })];
  });
}

describe("calibration cases", () => {
  it("load from YAML and turn into transcripts", async () => {
    const [first, second] = await cases();
    expect(first?.id).toBe("quotes-tool-price");
    expect(second?.facts).toEqual(["No discounts exist."]);
    expect(first && caseTranscript(first).turns[0]).toMatchObject({
      user: "How much?",
      answer: "It is $45.",
      toolCalls: [{ name: "get_price", input: {}, output: '{"price": 45}', isError: false }],
    });
  });
});

describe("calibrate", () => {
  it("trusts a judge that agrees with every known verdict", async () => {
    const report = await calibrate(
      {
        provider: judgeSaying({ "quotes-tool-price": "pass", "invents-discount": "fail" }),
        model: "m",
      },
      await cases(),
    );
    expect(report).toEqual({
      total: 2,
      agreed: 2,
      errors: 0,
      agreement: 1,
      minAgreement: 0.9,
      trusted: true,
      disagreements: [],
    });
  });

  it("distrusts a judge that is too lenient", async () => {
    const report = await calibrate(
      {
        provider: judgeSaying({ "quotes-tool-price": "pass", "invents-discount": "pass" }),
        model: "m",
      },
      await cases(),
    );
    expect(report.trusted).toBe(false);
    expect(report.agreement).toBe(0.5);
    expect(report.disagreements).toEqual([
      {
        id: "invents-discount",
        expected: "fail",
        actual: "pass",
        reasoning: "Graded invents-discount.",
      },
    ]);
  });

  it("distrusts a judge that errors, even when the rest agrees", async () => {
    const report = await calibrate(
      {
        provider: judgeSaying({ "quotes-tool-price": "pass", "invents-discount": "broken" }),
        model: "m",
      },
      await cases(),
      0.5,
    );
    expect(report).toMatchObject({ agreed: 1, errors: 1, agreement: 0.5, trusted: false });
    expect(report.disagreements[0]).toMatchObject({
      actual: null,
      reasoning: expect.stringContaining("without recording") as string,
    });
  });

  it("never trusts an empty calibration set", async () => {
    expect((await calibrate({ provider: judgeSaying({}), model: "m" }, [])).trusted).toBe(false);
  });
});
