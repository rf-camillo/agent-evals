import { describe, expect, it } from "vitest";

import { answerCheck } from "../../src/checks/answer.js";
import { groundedCheck } from "../../src/checks/grounded.js";
import { handoffCheck } from "../../src/checks/handoff.js";
import { runChecks } from "../../src/checks/run-checks.js";
import { weatherAgent } from "../support/helpers.js";
import { scenario, transcript } from "../support/transcripts.js";

const agent = weatherAgent({ handoffTool: "handoff_to_staff" });

describe("answerCheck", () => {
  const conversation = transcript(
    { answer: "We have a Café session." },
    { answer: "Your booking is CONFIRMED." },
  );

  it("is skipped without phrases", () => {
    expect(answerCheck({ scenario: scenario(), transcript: conversation, agent })).toBeNull();
  });

  it("matches the final answer ignoring case and accents", () => {
    const expect_ = { answer: { contains: ["confirmed"] } };
    expect(
      answerCheck({ scenario: scenario({ expect: expect_ }), transcript: conversation, agent })
        ?.passed,
    ).toBe(true);
  });

  it("checks forbidden phrases in every answer", () => {
    const expect_ = { answer: { contains: ["refund"], notContains: ["cafe"] } };
    expect(
      answerCheck({ scenario: scenario({ expect: expect_ }), transcript: conversation, agent })
        ?.failures,
    ).toEqual(['final answer does not mention "refund"', 'an answer mentions "cafe"']);
  });
});

describe("groundedCheck", () => {
  const grounded = scenario({
    expect: { grounded: true },
    facts: ["Classes last 90 minutes and start at 10am."],
  });

  it("passes when every detail comes from tools, facts or the user", () => {
    const conversation = transcript({
      user: "Anything on October 3?",
      answer: "Yes: October 3 at 10:00, $45, and a 6:30 pm slot for $40.",
      calls: [
        {
          name: "check_availability",
          output: '{"slots":[{"start":"18:30","price":40},{"price":45}]}',
        },
      ],
    });
    expect(
      groundedCheck({ scenario: grounded, transcript: conversation, agent })?.failures,
    ).toEqual([]);
  });

  it("flags invented prices and times, ignoring failed tool output and tool inputs", () => {
    const conversation = transcript({
      answer: "It costs $35 and starts at 11am.",
      calls: [
        { name: "check_availability", input: { price: 35 }, output: "price 11", isError: true },
      ],
    });
    expect(
      groundedCheck({ scenario: grounded, transcript: conversation, agent })?.failures,
    ).toEqual([
      'money "$35" is not backed by a tool result, a fact or the user',
      'time "11am" is not backed by a tool result, a fact or the user',
    ]);
  });

  it("is skipped unless asked", () => {
    expect(
      groundedCheck({ scenario: scenario(), transcript: transcript({ answer: "$1" }), agent }),
    ).toBeNull();
  });
});

describe("handoffCheck", () => {
  const handedOff = transcript({
    answer: "A person will reply.",
    calls: [{ name: "handoff_to_staff" }],
  });
  const handled = transcript({ answer: "Done." });

  it("requires the handoff when expected and forbids it otherwise", () => {
    const yes = scenario({ expect: { handoff: true } });
    const no = scenario({ expect: { handoff: false } });
    expect(handoffCheck({ scenario: yes, transcript: handedOff, agent })?.passed).toBe(true);
    expect(handoffCheck({ scenario: yes, transcript: handled, agent })?.failures).toEqual([
      "expected a handoff through handoff_to_staff",
    ]);
    expect(handoffCheck({ scenario: no, transcript: handedOff, agent })?.failures).toEqual([
      "handed off through handoff_to_staff without need",
    ]);
    expect(handoffCheck({ scenario: no, transcript: handled, agent })?.passed).toBe(true);
  });

  it("fails clearly when the agent has no handoff tool, and is skipped when not asked", () => {
    const yes = scenario({ expect: { handoff: true } });
    expect(
      handoffCheck({ scenario: yes, transcript: handled, agent: weatherAgent() })?.failures,
    ).toEqual(['the agent "weather" declares no handoffTool']);
    expect(handoffCheck({ scenario: scenario(), transcript: handled, agent })).toBeNull();
  });
});

describe("runChecks", () => {
  it("runs only the checks the scenario asks for, in order", () => {
    const results = runChecks({
      scenario: scenario({
        expect: { handoff: false, answer: { contains: ["done"] }, tools: [{ call: "x" }] },
      }),
      transcript: transcript({ answer: "Done." }),
      agent,
    });
    expect(results.map((item) => [item.name, item.passed])).toEqual([
      ["tools", false],
      ["answer", true],
      ["handoff", true],
    ]);
  });
});
