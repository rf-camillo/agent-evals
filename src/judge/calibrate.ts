import { mapWithLimit } from "../core/concurrency.js";
import { errorMessage } from "../core/errors.js";
import { type CalibrationCase, caseTranscript } from "./calibration-case.js";
import { JUDGE_DEFAULTS } from "./defaults.js";
import { judge, type JudgeConfig, type Verdict } from "./judge.js";

export const DEFAULT_MIN_AGREEMENT = 0.9;

export interface CalibrationOutcome {
  id: string;
  expected: Verdict;
  actual: Verdict | null;
  reasoning: string;
}

/** How often the judge agrees with known verdicts, and whether that is enough to trust it. */
export interface CalibrationReport {
  total: number;
  agreed: number;
  errors: number;
  agreement: number;
  minAgreement: number;
  trusted: boolean;
  disagreements: CalibrationOutcome[];
}

async function grade(config: JudgeConfig, item: CalibrationCase): Promise<CalibrationOutcome> {
  const base = { id: item.id, expected: item.expected };
  try {
    const result = await judge(config, {
      rubric: item.rubric,
      facts: item.facts,
      transcript: caseTranscript(item),
    });
    return { ...base, actual: result.verdict, reasoning: result.reasoning };
  } catch (error) {
    return { ...base, actual: null, reasoning: errorMessage(error) };
  }
}

/**
 * Runs the judge on every case. The judge is trusted only when it agrees often enough
 * and never errors: an instrument that fails silently would make every result suspect.
 */
export async function calibrate(
  config: JudgeConfig,
  cases: readonly CalibrationCase[],
  minAgreement = DEFAULT_MIN_AGREEMENT,
): Promise<CalibrationReport> {
  const outcomes = await mapWithLimit(cases, JUDGE_DEFAULTS.concurrency, (item) =>
    grade(config, item),
  );
  const agreed = outcomes.filter((outcome) => outcome.actual === outcome.expected).length;
  const errors = outcomes.filter((outcome) => outcome.actual === null).length;
  const agreement = cases.length === 0 ? 0 : agreed / cases.length;
  return {
    total: cases.length,
    agreed,
    errors,
    agreement,
    minAgreement,
    trusted: cases.length > 0 && errors === 0 && agreement >= minAgreement,
    disagreements: outcomes.filter((outcome) => outcome.actual !== outcome.expected),
  };
}
