import { describe, expect, it } from "vitest";

import { ScriptedProvider, text, toolCall } from "../../src/providers/scripted.js";
import type { CompletionRequest } from "../../src/providers/types.js";
import { runAttempt } from "../../src/runner/run-attempt.js";
import { runEvals } from "../../src/runner/run-evals.js";
import type { LoadedScenario } from "../../src/scenarios/load.js";
import { weatherAgent } from "../support/helpers.js";
import { scenario } from "../support/transcripts.js";

function loaded(fields: Record<string, unknown>): LoadedScenario {
  return { file: "scenarios.yaml", scenario: scenario(fields) };
}

const forecast = loaded({
  id: "forecast",
  turns: [{ user: "Weather in Lisbon?" }],
  expect: {
    tools: [{ call: "get_forecast", args: { city: "Lisbon" } }],
    answer: { contains: ["sunny"] },
  },
});

function lastUserMessage(request: CompletionRequest): string {
  const users = request.messages.filter((message) => message.role === "user");
  const last = users.at(-1);
  return last?.role === "user" ? last.content : "";
}

/** Calls the tool once, then answers; `answer` decides the final text. */
function weatherModel(answer: () => string): ScriptedProvider {
  return new ScriptedProvider((request) =>
    request.messages.at(-1)?.role === "tool"
      ? [text(answer())]
      : [
          toolCall("get_forecast", {
            city: lastUserMessage(request).includes("Lisbon") ? "Lisbon" : "Porto",
          }),
        ],
  );
}

const judgeModel = (verdict: "pass" | "fail") =>
  new ScriptedProvider(() => [toolCall("record_verdict", { reasoning: "Checked.", verdict })]);

describe("runAttempt", () => {
  it("passes when every check passes and reports usage and cost", async () => {
    const result = await runAttempt(
      {
        agent: weatherAgent(),
        provider: weatherModel(() => "Sunny, 24°C."),
        prices: { "test-model": { inputPerMillion: 1, outputPerMillion: 5 } },
      },
      forecast,
      1,
    );
    expect(result).toMatchObject({
      attempt: 1,
      status: "pass",
      error: null,
      judge: null,
      usage: {
        agent: { inputTokens: 200, outputTokens: 40 },
        judge: { inputTokens: 0, outputTokens: 0 },
      },
      costUsd: 0.0004,
    });
    expect(result.checks.map((check) => check.name)).toEqual(["tools", "answer"]);
  });

  it("fails when a check fails", async () => {
    const result = await runAttempt(
      { agent: weatherAgent(), provider: weatherModel(() => "Rainy.") },
      forecast,
      1,
    );
    expect(result.status).toBe("fail");
    expect(result.costUsd).toBeNull();
  });

  it("fails when the judge fails, and records its reasoning", async () => {
    const judged = loaded({ ...forecast.scenario, judge: { rubric: "Mentions the high." } });
    const result = await runAttempt(
      {
        agent: weatherAgent(),
        provider: weatherModel(() => "Sunny."),
        judge: { provider: judgeModel("fail"), model: "judge-model" },
      },
      judged,
      1,
    );
    expect(result.status).toBe("fail");
    expect(result.judge).toEqual({ verdict: "fail", reasoning: "Checked." });
    expect(result.usage.judge).toEqual({ inputTokens: 100, outputTokens: 20 });
  });

  it("reports provider failures, judge failures and timeouts as errors", async () => {
    const broken = await runAttempt(
      { agent: weatherAgent(), provider: ScriptedProvider.sequence([]) },
      forecast,
      1,
    );
    expect(broken).toMatchObject({ status: "error", error: { code: "PROVIDER_ERROR" } });
    expect(broken.transcript?.turns).toEqual([
      { user: "Weather in Lisbon?", answer: "", toolCalls: [], modelCalls: [], rejections: [] },
    ]);

    const judged = loaded({ ...forecast.scenario, judge: { rubric: "Anything." } });
    const silentJudge = await runAttempt(
      {
        agent: weatherAgent(),
        provider: weatherModel(() => "Sunny."),
        judge: { provider: new ScriptedProvider(() => [text("Fine.")]), model: "j" },
      },
      judged,
      1,
    );
    expect(silentJudge).toMatchObject({ status: "error", error: { code: "JUDGE_ERROR" } });

    const slow = new ScriptedProvider(
      () => new Promise((resolve) => setTimeout(() => resolve([text("late")]), 200)),
    );
    const timedOut = await runAttempt(
      { agent: weatherAgent(), provider: slow, timeoutMs: 20 },
      forecast,
      1,
    );
    expect(timedOut).toMatchObject({ status: "error", error: { code: "TIMEOUT" } });
  });

  it("reports unexpected exceptions without crashing", async () => {
    const agent = weatherAgent({
      createTools: () => {
        throw new Error("backend offline");
      },
    });
    const result = await runAttempt({ agent, provider: weatherModel(() => "x") }, forecast, 1);
    expect(result.error).toEqual({ code: "UNEXPECTED", message: "backend offline" });
  });
});

describe("runEvals", () => {
  it("repeats scenarios, keeps their order and summarizes", async () => {
    let call = 0;
    const flakyAnswer = () => (call++ % 2 === 0 ? "Sunny." : "Rainy.");
    const steady = loaded({
      id: "steady",
      turns: [{ user: "Weather in Porto?" }],
      expect: { tools: [{ call: "get_forecast" }] },
    });
    const progress: number[] = [];

    const result = await runEvals(
      [forecast, steady],
      { agent: weatherAgent(), provider: weatherModel(flakyAnswer), repeat: 2, concurrency: 1 },
      (done) => progress.push(done),
    );

    expect(result.scenarios.map((item) => [item.id, item.status, item.passRate])).toEqual([
      ["forecast", "flaky", 0.5],
      ["steady", "pass", 1],
    ]);
    expect(result.summary).toMatchObject({
      scenarios: 2,
      attempts: 4,
      passed: 3,
      failed: 1,
      errors: 0,
      passRate: 0.75,
      byStatus: { pass: 1, fail: 0, flaky: 1, error: 0 },
      costUsd: null,
    });
    expect(progress).toEqual([1, 2, 3, 4]);
    expect(result).toMatchObject({
      version: 1,
      repeat: 2,
      agent: { name: "weather", model: "test-model" },
      judge: null,
    });
  });

  it("refuses to start when a scenario needs a judge that is not configured", async () => {
    const judged = loaded({ ...forecast.scenario, judge: { rubric: "Anything." } });
    await expect(
      runEvals([forecast, judged], {
        agent: weatherAgent(),
        provider: weatherModel(() => "Sunny."),
      }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });
});
