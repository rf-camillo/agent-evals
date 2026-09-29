import { scenarioPassRate, scenarioStatus, summarize } from "../../src/runner/summarize.js";
import type {
  AttemptResult,
  AttemptStatus,
  RunResult,
  ScenarioResult,
} from "../../src/runner/types.js";

const EMPTY = { inputTokens: 0, outputTokens: 0 };

export function attempt(status: AttemptStatus, fields: Partial<AttemptResult> = {}): AttemptResult {
  return {
    attempt: 1,
    status,
    checks:
      status === "fail"
        ? [
            {
              name: "answer",
              passed: false,
              failures: ['final answer does not mention "confirmed"'],
            },
          ]
        : [],
    judge: null,
    error: status === "error" ? { code: "TIMEOUT", message: "Timed out after 10 ms" } : null,
    transcript: null,
    usage: { agent: { inputTokens: 1000, outputTokens: 200 }, judge: EMPTY },
    costUsd: 0.002,
    latencyMs: 1500,
    ...fields,
  };
}

export function scenarioResult(id: string, attempts: AttemptResult[]): ScenarioResult {
  const numbered = attempts.map((item, index) => ({ ...item, attempt: index + 1 }));
  return {
    id,
    file: "scenarios.yaml",
    tags: [],
    status: scenarioStatus(numbered),
    passRate: scenarioPassRate(numbered),
    attempts: numbered,
  };
}

export function run(scenarios: ScenarioResult[]): RunResult {
  return {
    version: 1,
    startedAt: "2026-09-29T12:00:00.000Z",
    finishedAt: "2026-09-29T12:01:00.000Z",
    agent: { name: "harbor", model: "claude-haiku-4-5" },
    judge: { model: "claude-sonnet-5" },
    repeat: scenarios[0]?.attempts.length ?? 1,
    summary: summarize(scenarios),
    scenarios,
  };
}
