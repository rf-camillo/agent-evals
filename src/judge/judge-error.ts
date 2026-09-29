import { EvalError } from "../core/errors.js";
import type { Usage } from "../providers/types.js";

/** The judge answered, but not with a usable verdict. Carries the tokens that answer cost. */
export class JudgeError extends EvalError {
  readonly usage: Usage;

  constructor(message: string, usage: Usage) {
    super("JUDGE_ERROR", message);
    this.name = "JudgeError";
    this.usage = usage;
  }
}
