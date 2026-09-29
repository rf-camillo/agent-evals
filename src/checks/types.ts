import type { AgentDefinition } from "../agent/definition.js";
import type { Transcript } from "../agent/transcript.js";
import type { Scenario } from "../scenarios/schema.js";

export const CHECK_NAMES = ["tools", "forbiddenTools", "answer", "grounded", "handoff"] as const;

export type CheckName = (typeof CHECK_NAMES)[number];

/** The outcome of one deterministic check; `failures` explains every miss. */
export interface CheckResult {
  name: CheckName;
  passed: boolean;
  failures: string[];
}

export interface CheckContext {
  scenario: Scenario;
  transcript: Transcript;
  agent: AgentDefinition;
}

/** Returns `null` when the scenario does not ask for this check. */
export type Check = (context: CheckContext) => CheckResult | null;

export function checkResult(name: CheckName, failures: readonly string[]): CheckResult {
  return { name, passed: failures.length === 0, failures: [...failures] };
}
