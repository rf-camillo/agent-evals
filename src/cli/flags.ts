import { EvalError } from "../core/errors.js";

export function integerFlag(value: string | undefined, flag: string, min = 1): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new EvalError("INVALID_INPUT", `--${flag} must be an integer of at least ${String(min)}`);
  }
  return parsed;
}

export function ratioFlag(value: string | undefined, flag: string): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new EvalError("INVALID_INPUT", `--${flag} must be a number between 0 and 1`);
  }
  return parsed;
}

export function requireArg(value: string | undefined, what: string): string {
  if (value === undefined || value.trim() === "") {
    throw new EvalError("INVALID_INPUT", `Missing ${what}. Run agent-evals --help.`);
  }
  return value;
}
