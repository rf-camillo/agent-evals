import { describe, expect, it } from "vitest";

import { judge } from "../../src/judge/judge.js";
import { JUDGE_SYSTEM, judgePrompt, VERDICT_TOOL } from "../../src/judge/prompt.js";
import { renderTranscript } from "../../src/judge/render-transcript.js";
import { ScriptedProvider, text, toolCall } from "../../src/providers/scripted.js";
import { transcript } from "../support/transcripts.js";

const conversation = transcript({
  user: "How much is the wheel class?",
  answer: "It is $45.",
  calls: [
    { name: "get_price", input: { class: "wheel" }, output: '{"price":45}' },
    { name: "get_discount", output: "Service down", isError: true },
  ],
});

const input = {
  rubric: "Quotes the price from the tools.",
  facts: ["Prices include clay."],
  transcript: conversation,
};

describe("renderTranscript", () => {
  it("shows users, tool calls, results, errors and answers", () => {
    expect(renderTranscript(conversation)).toBe(
      [
        "<conversation>",
        "## Turn 1",
        "USER: How much is the wheel class?",
        'TOOL CALL get_price {"class":"wheel"}',
        'TOOL RESULT: {"price":45}',
        "TOOL CALL get_discount {}",
        "TOOL ERROR: Service down",
        "AGENT: It is $45.",
        "</conversation>",
      ].join("\n"),
    );
  });

  it("truncates very long tool output", () => {
    const long = transcript({ answer: "ok", calls: [{ name: "dump", output: "x".repeat(5000) }] });
    expect(renderTranscript(long)).toContain(`${"x".repeat(2000)}… (truncated)`);
  });
});

describe("judgePrompt", () => {
  it("puts rubric, facts and conversation in labeled sections", () => {
    const prompt = judgePrompt(input);
    expect(prompt).toMatch(
      /^# Rubric\n\nQuotes the price from the tools\.\n\n# Facts\n\n- Prices include clay\.\n\n# Conversation\n\n<conversation>\n## Turn 1/,
    );
    expect(judgePrompt({ ...input, facts: [] })).toContain("# Facts\n\nNone.");
  });
});

describe("judge", () => {
  it("forces the verdict tool without a temperature and returns the verdict", async () => {
    const provider = ScriptedProvider.sequence([
      [
        text("Thinking."),
        toolCall("record_verdict", { reasoning: "Price matches the tool.", verdict: "pass" }),
      ],
    ]);
    const result = await judge({ provider, model: "judge-model" }, input);

    expect(result).toMatchObject({
      verdict: "pass",
      reasoning: "Price matches the tool.",
      usage: { inputTokens: 100 },
    });
    expect(provider.requests[0]).not.toHaveProperty("temperature");
    expect(provider.requests[0]).toMatchObject({
      model: "judge-model",
      system: JUDGE_SYSTEM,
      forceTool: "record_verdict",
      tools: [VERDICT_TOOL],
    });
  });

  it("treats a missing verdict as a judge error, never a pass", async () => {
    const provider = ScriptedProvider.sequence([[text("Looks good to me!")]]);
    await expect(judge({ provider, model: "m" }, input)).rejects.toMatchObject({
      code: "JUDGE_ERROR",
    });
  });

  it("treats a malformed verdict as a judge error", async () => {
    const provider = ScriptedProvider.sequence([
      [toolCall("record_verdict", { verdict: "maybe" })],
    ]);
    await expect(judge({ provider, model: "m" }, input)).rejects.toMatchObject({
      code: "JUDGE_ERROR",
      message: expect.stringContaining("malformed") as string,
    });
  });

  it("lets provider failures through as provider errors", async () => {
    const provider = ScriptedProvider.sequence([]);
    await expect(judge({ provider, model: "m" }, input)).rejects.toMatchObject({
      code: "PROVIDER_ERROR",
    });
  });
});
