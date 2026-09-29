import type { RunResult } from "../runner/types.js";
import { attemptProblems, guardRejections } from "./attempt-details.js";
import { duration, percent, STATUS_ICON, usd } from "./format.js";

/** A compact plain-text summary for the terminal. */
export function renderTerminal(result: RunResult): string {
  const { summary } = result;
  const lines = [
    `${result.agent.name} (${result.agent.model}) · ${String(summary.scenarios)} scenarios × ${String(result.repeat)}`,
    "",
    ...result.scenarios.map(
      (scenario) => `${STATUS_ICON[scenario.status]} ${scenario.id} ${percent(scenario.passRate)}`,
    ),
  ];
  for (const scenario of result.scenarios) {
    for (const attempt of scenario.attempts.filter((item) => item.status !== "pass")) {
      for (const problem of attemptProblems(attempt)) {
        lines.push(`   ${scenario.id} #${String(attempt.attempt)} ${problem}`);
      }
    }
  }
  for (const scenario of result.scenarios) {
    for (const attempt of scenario.attempts) {
      const held = guardRejections(attempt).length;
      if (held > 0) {
        const answers = held === 1 ? "answer" : "answers";
        lines.push(
          `   🛡️ ${scenario.id} #${String(attempt.attempt)} guard held back ${String(held)} ${answers}`,
        );
      }
    }
  }
  lines.push(
    "",
    `Pass rate ${percent(summary.passRate)} (${String(summary.passed)}/${String(summary.attempts)}) · errors ${String(summary.errors)} · cost ${usd(summary.costUsd)} · p50 ${duration(summary.latencyMs.p50)} · p95 ${duration(summary.latencyMs.p95)}`,
  );
  return lines.join("\n");
}
