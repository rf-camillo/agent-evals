import type { GuardRejection } from "../agent/transcript.js";
import type { AttemptResult } from "../runner/types.js";

/** One line per reason an attempt did not pass: failed checks, a failing judge, or an error. */
export function attemptProblems(attempt: AttemptResult): string[] {
  if (attempt.error !== null) return [`${attempt.error.code}: ${attempt.error.message}`];
  const checks = attempt.checks
    .filter((check) => !check.passed)
    .flatMap((check) => check.failures.map((failure) => `${check.name}: ${failure}`));
  const judged = attempt.judge?.verdict === "fail" ? [`judge: ${attempt.judge.reasoning}`] : [];
  return [...checks, ...judged];
}

/** The answers guards held back during an attempt, in order. */
export function guardRejections(attempt: AttemptResult): GuardRejection[] {
  return attempt.transcript?.turns.flatMap((turn) => turn.rejections) ?? [];
}
