import type { RunResult, ScenarioResult } from "../runner/types.js";
import { attemptProblems, guardRejections } from "./attempt-details.js";
import { duration, percent, STATUS_ICON, tokens, usd } from "./format.js";
import { markdownTable } from "./markdown-table.js";

function averageLatency(scenario: ScenarioResult): number {
  const total = scenario.attempts.reduce((sum, attempt) => sum + attempt.latencyMs, 0);
  return scenario.attempts.length === 0 ? 0 : total / scenario.attempts.length;
}

function header(result: RunResult): string {
  const judge = result.judge === null ? "none" : `\`${result.judge.model}\``;
  const agent = `\`${result.agent.name}\` on \`${result.agent.model}\``;
  return `**Agent** ${agent} · **Judge** ${judge} · **Repeat** ${String(result.repeat)}`;
}

function summaryTable({ summary }: RunResult): string {
  const { byStatus, usage, latencyMs } = summary;
  const scenarios = `${String(byStatus.pass)} pass · ${String(byStatus.flaky)} flaky · ${String(byStatus.fail)} fail · ${String(byStatus.error)} error`;
  const agentTokens = tokens(usage.agent.inputTokens + usage.agent.outputTokens);
  const judgeTokens = tokens(usage.judge.inputTokens + usage.judge.outputTokens);
  return markdownTable(
    [
      "Pass rate",
      "Scenarios",
      "Attempts",
      "Errors",
      "Cost",
      "Latency p50 / p95",
      "Tokens (agent / judge)",
    ],
    [
      [
        `**${percent(summary.passRate)}**`,
        scenarios,
        `${String(summary.passed)} / ${String(summary.attempts)}`,
        String(summary.errors),
        usd(summary.costUsd),
        `${duration(latencyMs.p50)} / ${duration(latencyMs.p95)}`,
        `${agentTokens} / ${judgeTokens}`,
      ],
    ],
  );
}

function scenariosSection(result: RunResult): string {
  const rows = result.scenarios.map((scenario) => [
    STATUS_ICON[scenario.status],
    `\`${scenario.id}\``,
    percent(scenario.passRate),
    duration(averageLatency(scenario)),
  ]);
  return `## Scenarios\n\n${markdownTable(["", "Scenario", "Pass rate", "Avg latency"], rows)}`;
}

function problemsSection(result: RunResult): string | null {
  const blocks = result.scenarios.flatMap((scenario) =>
    scenario.attempts
      .filter((attempt) => attempt.status !== "pass")
      .map((attempt) => {
        const title = `### ${STATUS_ICON[attempt.status]} \`${scenario.id}\` · attempt ${String(attempt.attempt)}`;
        const lines = attemptProblems(attempt).map((problem) => `- ${problem.replace(/\n/g, " ")}`);
        return [title, "", ...lines].join("\n");
      }),
  );
  return blocks.length === 0 ? null : `## What went wrong\n\n${blocks.join("\n\n")}`;
}

function guardsSection(result: RunResult): string | null {
  const blocks = result.scenarios.flatMap((scenario) =>
    scenario.attempts.flatMap((attempt) => {
      const rejections = guardRejections(attempt);
      if (rejections.length === 0) return [];
      const title = `### 🛡️ \`${scenario.id}\` · attempt ${String(attempt.attempt)}`;
      const lines = rejections.map(
        (rejection) =>
          `- Held back: ${quote(rejection.answer)}\n  Feedback: ${quote(rejection.feedback)}`,
      );
      return [[title, "", ...lines].join("\n")];
    }),
  );
  if (blocks.length === 0) return null;
  const intro = "Answers a guard stopped before they reached the customer.";
  return `## Guards\n\n${intro}\n\n${blocks.join("\n\n")}`;
}

function quote(text: string): string {
  return `“${text.replace(/\s+/g, " ").trim()}”`;
}

/** A Markdown report, readable on its own or as a pull request comment. */
export function renderMarkdown(result: RunResult): string {
  const sections = [
    "# Agent evaluation",
    header(result),
    summaryTable(result),
    scenariosSection(result),
    problemsSection(result),
    guardsSection(result),
  ].filter((section): section is string => section !== null);
  return `${sections.join("\n\n")}\n`;
}
