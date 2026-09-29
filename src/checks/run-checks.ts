import { answerCheck } from "./answer.js";
import { groundedCheck } from "./grounded.js";
import { handoffCheck } from "./handoff.js";
import { forbiddenToolsCheck, toolsCheck } from "./tools.js";
import type { Check, CheckContext, CheckResult } from "./types.js";

const CHECKS: readonly Check[] = [
  toolsCheck,
  forbiddenToolsCheck,
  answerCheck,
  groundedCheck,
  handoffCheck,
];

/** Runs every deterministic check the scenario asks for, in a fixed order. */
export function runChecks(context: CheckContext): CheckResult[] {
  return CHECKS.flatMap((check) => check(context) ?? []);
}
