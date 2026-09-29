import { describe, expect, it } from "vitest";

import { toToolSpec } from "../../src/agent/definition.js";
import { runConversation } from "../../src/agent/run-conversation.js";
import { allToolCalls, finalAnswer } from "../../src/agent/transcript.js";
import { ScriptedProvider, text, toolCall } from "../../src/providers/scripted.js";
import { weatherAgent } from "../support/helpers.js";

describe("runConversation", () => {
  it("runs tools until the model answers, and records the turn", async () => {
    const provider = ScriptedProvider.sequence([
      [text("Let me check."), toolCall("get_forecast", { city: "Lisbon" })],
      [text("Sunny in Lisbon, 24°C.")],
    ]);
    const transcript = await runConversation(weatherAgent(), provider, ["Weather in Lisbon?"]);

    expect(finalAnswer(transcript)).toBe("Let me check.\n\nSunny in Lisbon, 24°C.");
    expect(allToolCalls(transcript)).toMatchObject([
      {
        name: "get_forecast",
        input: { city: "Lisbon" },
        output: '{"city":"Lisbon","forecast":"sunny","high":24}',
        isError: false,
      },
    ]);
    expect(transcript.turns[0]?.modelCalls).toHaveLength(2);
    expect(transcript.usage).toEqual({ inputTokens: 200, outputTokens: 40 });
  });

  it("keeps what the agent said before calling a tool as part of the answer", async () => {
    const provider = ScriptedProvider.sequence([
      [text("I'm sorry that happened."), toolCall("get_forecast", { city: "Lisbon" })],
      [text("A person will follow up.")],
    ]);
    const transcript = await runConversation(weatherAgent(), provider, ["It was awful."]);
    expect(finalAnswer(transcript)).toBe("I'm sorry that happened.\n\nA person will follow up.");
  });

  it("sends the system prompt, tools and history to the model", async () => {
    const provider = ScriptedProvider.sequence([
      [toolCall("get_forecast", { city: "Lisbon" })],
      [text("Sunny.")],
    ]);
    await runConversation(weatherAgent(), provider, ["Weather?"]);
    const second = provider.requests[1];
    expect(second?.system).toBe("You answer weather questions.");
    expect(second?.tools.map((tool) => tool.name)).toEqual(["get_forecast"]);
    expect(second?.messages.map((message) => message.role)).toEqual(["user", "assistant", "tool"]);
    expect(second).not.toHaveProperty("temperature");
  });

  it("keeps history across user turns", async () => {
    const provider = ScriptedProvider.sequence([[text("Hi!")], [text("Bye!")]]);
    const transcript = await runConversation(weatherAgent(), provider, ["Hello", "Goodbye"]);
    expect(transcript.turns.map((turn) => [turn.user, turn.answer])).toEqual([
      ["Hello", "Hi!"],
      ["Goodbye", "Bye!"],
    ]);
    expect(provider.requests[1]?.messages).toHaveLength(3);
  });

  it("returns tool failures and invalid input to the model as errors", async () => {
    const provider = ScriptedProvider.sequence([
      [
        toolCall("get_forecast", { city: "Atlantis" }),
        toolCall("get_forecast", { town: "Lisbon" }),
        toolCall("launch_rocket"),
      ],
      [text("Sorry.")],
    ]);
    const transcript = await runConversation(weatherAgent(), provider, ["Weather?"]);
    expect(allToolCalls(transcript).map((call) => [call.isError, call.output])).toEqual([
      [true, "City not found"],
      [true, expect.stringMatching(/^Invalid input: city/)],
      [true, 'Unknown tool "launch_rocket"'],
    ]);
  });

  it("fails when the agent loops past the step limit", async () => {
    const provider = new ScriptedProvider(() => [toolCall("get_forecast", { city: "Lisbon" })]);
    await expect(
      runConversation(weatherAgent({ maxSteps: 3 }), provider, ["Weather?"]),
    ).rejects.toMatchObject({ code: "MAX_STEPS" });
    expect(provider.requests).toHaveLength(3);
  });

  it("creates fresh tools for every conversation", async () => {
    let created = 0;
    const agent = weatherAgent();
    const counting = { ...agent, createTools: () => ((created += 1), agent.createTools()) };
    await runConversation(counting, ScriptedProvider.sequence([[text("a")]]), ["x"]);
    await runConversation(counting, ScriptedProvider.sequence([[text("b")]]), ["y"]);
    expect(created).toBe(2);
  });
});

describe("toToolSpec", () => {
  it("turns the zod input into a JSON schema without the $schema key", () => {
    const [tool] = weatherAgent().createTools();
    expect(tool && toToolSpec(tool)).toEqual({
      name: "get_forecast",
      description: "Forecast for a city",
      inputSchema: {
        type: "object",
        properties: { city: { type: "string" } },
        required: ["city"],
        additionalProperties: false,
      },
    });
  });
});
