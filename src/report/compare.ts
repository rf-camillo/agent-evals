import type { RunResult, ScenarioResult } from "../runner/types.js";

export interface ScenarioChange {
  id: string;
  before: number;
  after: number;
}

/** What changed between a baseline run and a candidate run. */
export interface Comparison {
  passRate: { before: number; after: number; delta: number };
  costUsd: { before: number | null; after: number | null };
  latencyP50: { before: number; after: number };
  regressions: ScenarioChange[];
  improvements: ScenarioChange[];
  added: string[];
  removed: string[];
  errors: number;
  maxDrop: number;
  failed: boolean;
}

export const DEFAULT_MAX_DROP = 0;

function byId(result: RunResult): Map<string, ScenarioResult> {
  return new Map(result.scenarios.map((scenario) => [scenario.id, scenario]));
}

/**
 * Compares two runs scenario by scenario. The comparison fails when the pass rate drops
 * by more than `maxDrop`, when a scenario regresses, or when the candidate has errors.
 */
export function compareRuns(
  baseline: RunResult,
  candidate: RunResult,
  maxDrop = DEFAULT_MAX_DROP,
): Comparison {
  const before = byId(baseline);
  const after = byId(candidate);
  const changes = [...after.values()].flatMap((scenario): ScenarioChange[] => {
    const previous = before.get(scenario.id);
    return previous === undefined
      ? []
      : [{ id: scenario.id, before: previous.passRate, after: scenario.passRate }];
  });
  const regressions = changes.filter((change) => change.after < change.before);
  const delta =
    Math.round((candidate.summary.passRate - baseline.summary.passRate) * 10_000) / 10_000;
  return {
    passRate: { before: baseline.summary.passRate, after: candidate.summary.passRate, delta },
    costUsd: { before: baseline.summary.costUsd, after: candidate.summary.costUsd },
    latencyP50: { before: baseline.summary.latencyMs.p50, after: candidate.summary.latencyMs.p50 },
    regressions,
    improvements: changes.filter((change) => change.after > change.before),
    added: [...after.keys()].filter((id) => !before.has(id)),
    removed: [...before.keys()].filter((id) => !after.has(id)),
    errors: candidate.summary.errors,
    maxDrop,
    failed: -delta > maxDrop || regressions.length > 0 || candidate.summary.errors > 0,
  };
}
