import { describe, expect, it } from "vitest";

import type { AnswerGuard } from "../../src/agent/definition.js";
import { runConversation } from "../../src/agent/run-conversation.js";
import { finalAnswer } from "../../src/agent/transcript.js";
import { ScriptedProvider, text, toolCall } from "../../src/providers/scripted.js";
import { weatherAgent } from "../support/helpers.js";

const noInventedForecast: AnswerGuard = ({ answer, toolCalls }) =>
  /sunny/i.test(answer) && !toolCalls.some((call) => call.name === "get_forecast" && !call.isError)
    ? "You described the weather without calling get_forecast. Call it first."
    : null;

describe("answer guards", () => {
  it("let accepted answers through untouched", async () => {
    const provider = ScriptedProvider.sequence([
      [toolCall("get_forecast", { city: "Lisbon" })],
      [text("Sunny in Lisbon.")],
    ]);
    const transcript = await runConversation(
      weatherAgent({ guards: [noInventedForecast] }),
      provider,
      ["Weather?"],
    );
    expect(finalAnswer(transcript)).toBe("Sunny in Lisbon.");
    expect(transcript.turns[0]?.rejections).toEqual([]);
  });

  it("send the feedback back and hide the rejected answer from the customer", async () => {
    const provider = ScriptedProvider.sequence([
      [text("It's sunny!")],
      [toolCall("get_forecast", { city: "Lisbon" })],
      [text("Checked: sunny in Lisbon, 24°C.")],
    ]);
    const transcript = await runConversation(
      weatherAgent({ guards: [noInventedForecast] }),
      provider,
      ["Weather in Lisbon?"],
    );
    const turn = transcript.turns[0];

    expect(turn?.answer).toBe("Checked: sunny in Lisbon, 24°C.");
    expect(turn?.rejections).toEqual([
      {
        answer: "It's sunny!",
        feedback: "You described the weather without calling get_forecast. Call it first.",
      },
    ]);
    const feedback = provider.requests[1]?.messages.at(-1);
    expect(feedback).toEqual({
      role: "user",
      content:
        "[Automatic check. This is not the customer, who never saw your last answer.] You described the weather without calling get_forecast. Call it first. Then answer the customer's last message directly, without mentioning this check.",
    });
  });

  it("see text said earlier in the turn and this turn's tool calls", async () => {
    const seen: string[] = [];
    const spy: AnswerGuard = ({ user, answer, toolCalls }) => {
      seen.push(`${user} | ${answer} | ${toolCalls.map((call) => call.name).join(",")}`);
      return null;
    };
    const provider = ScriptedProvider.sequence([
      [text("Let me check."), toolCall("get_forecast", { city: "Lisbon" })],
      [text("Sunny.")],
    ]);
    await runConversation(weatherAgent({ guards: [spy] }), provider, ["Weather?"]);
    expect(seen).toEqual(["Weather? | Let me check.\n\nSunny. | get_forecast"]);
  });

  it("fail the conversation when the agent never satisfies them", async () => {
    const provider = new ScriptedProvider(() => [text("Sunny, trust me.")]);
    await expect(
      runConversation(weatherAgent({ guards: [noInventedForecast], maxSteps: 3 }), provider, [
        "Weather?",
      ]),
    ).rejects.toMatchObject({ code: "MAX_STEPS" });
  });
});
