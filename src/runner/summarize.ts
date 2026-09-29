import { sumUsage } from "../agent/transcript.js";
import { sumCosts } from "./cost.js";
import type { AttemptResult, RunSummary, ScenarioResult, ScenarioStatus } from "./types.js";

export function percentile(values: readonly number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1);
  return sorted[Math.max(0, index)] ?? 0;
}

function ratio(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 10_000) / 10_000;
}

export function scenarioStatus(attempts: readonly AttemptResult[]): ScenarioStatus {
  if (attempts.some((attempt) => attempt.status === "error")) return "error";
  const passes = attempts.filter((attempt) => attempt.status === "pass").length;
  if (passes === attempts.length) return "pass";
  return passes === 0 ? "fail" : "flaky";
}

export function scenarioPassRate(attempts: readonly AttemptResult[]): number {
  return ratio(attempts.filter((attempt) => attempt.status === "pass").length, attempts.length);
}

export function summarize(scenarios: readonly ScenarioResult[]): RunSummary {
  const attempts = scenarios.flatMap((scenario) => scenario.attempts);
  const count = (status: AttemptResult["status"]) =>
    attempts.filter((attempt) => attempt.status === status).length;
  const byStatus: Record<ScenarioStatus, number> = { pass: 0, fail: 0, flaky: 0, error: 0 };
  for (const scenario of scenarios) byStatus[scenario.status] += 1;
  const latencies = attempts.map((attempt) => attempt.latencyMs);

  return {
    scenarios: scenarios.length,
    attempts: attempts.length,
    passed: count("pass"),
    failed: count("fail"),
    errors: count("error"),
    passRate: ratio(count("pass"), attempts.length),
    byStatus,
    usage: {
      agent: sumUsage(attempts.map((attempt) => attempt.usage.agent)),
      judge: sumUsage(attempts.map((attempt) => attempt.usage.judge)),
    },
    costUsd: sumCosts(attempts.map((attempt) => attempt.costUsd)),
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: Math.max(0, ...latencies),
    },
  };
}
