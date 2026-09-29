import type { Comparison, ScenarioChange } from "./compare.js";
import { duration, percent, signedPercentPoints, usd } from "./format.js";
import { markdownTable } from "./markdown-table.js";

function section(title: string, lines: readonly string[]): string[] {
  return lines.length === 0 ? [] : [`### ${title}`, "", ...lines, ""];
}

function changeLines(changes: readonly ScenarioChange[]): string[] {
  return changes.map(
    (change) => `- \`${change.id}\` ${percent(change.before)} → ${percent(change.after)}`,
  );
}

/** A Markdown summary of a comparison, suited to a pull request comment. */
export function renderComparison(comparison: Comparison): string {
  const { passRate, costUsd, latencyP50 } = comparison;
  const verdict = comparison.failed ? "❌ **Regression**" : "✅ **No regression**";
  const headline = `${verdict} · pass rate ${percent(passRate.before)} → ${percent(passRate.after)} (${signedPercentPoints(passRate.delta)}) · errors ${String(comparison.errors)}`;
  const table = markdownTable(
    ["", "Baseline", "Candidate"],
    [
      ["Pass rate", percent(passRate.before), percent(passRate.after)],
      ["Cost", usd(costUsd.before), usd(costUsd.after)],
      ["Latency p50", duration(latencyP50.before), duration(latencyP50.after)],
    ],
  );
  return [
    "# Agent evaluation: comparison",
    "",
    headline,
    "",
    table,
    "",
    ...section("Regressions", changeLines(comparison.regressions)),
    ...section("Improvements", changeLines(comparison.improvements)),
    ...section(
      "New scenarios",
      comparison.added.map((id) => `- \`${id}\``),
    ),
    ...section(
      "Removed scenarios",
      comparison.removed.map((id) => `- \`${id}\``),
    ),
  ]
    .join("\n")
    .trimEnd()
    .concat("\n");
}
